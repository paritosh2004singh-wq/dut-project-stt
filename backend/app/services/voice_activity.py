from __future__ import annotations

import importlib
import logging
import math
import sys
from array import array
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Protocol, Sequence

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class VADConfig:
    sample_rate: int = 16000
    chunk_duration_ms: int = 10
    threshold: float = 0.5
    min_speech_duration_ms: int = 250
    min_silence_duration_ms: int = 100
    speech_pad_ms: int = 30
    aggressiveness: int = 2

    @property
    def window_size_samples(self) -> int:
        return int(self.sample_rate * self.chunk_duration_ms / 1000)


@dataclass
class VADFrameResult:
    forwarded_chunks: list[bytes] = field(default_factory=list)
    speech_started: bool = False
    speech_ended: bool = False
    speech_confirmed: bool = False


class ProbabilityBackend(Protocol):
    def predict(self, window: bytes, samples: Sequence[float]) -> float:
        ...


class WebRtcVadBackend:
    def __init__(self, sample_rate: int, aggressiveness: int) -> None:
        self._sample_rate = sample_rate
        self._aggressiveness = aggressiveness
        self._vad = None

    def load(self) -> None:
        if self._vad is not None:
            return
        
        import webrtcvad
        self._vad = webrtcvad.Vad(self._aggressiveness)

    def predict(self, window: bytes, samples: Sequence[float]) -> float:
        if self._vad is None:
            self.load()

        assert self._vad is not None
        try:
            is_speech = self._vad.is_speech(window, self._sample_rate)
            return 1.0 if is_speech else 0.0
        except Exception as exc:
            logger.warning("WebRTC VAD error: %s", exc)
            return 0.0


class EnergyProbabilityBackend:
    """
    Lightweight fallback used when Silero dependencies are unavailable.
    """

    def __init__(self, threshold_hint: float = 0.02) -> None:
        self._threshold_hint = threshold_hint

    def predict(self, window: bytes, samples: Sequence[float]) -> float:
        if not samples:
            return 0.0

        energy = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
        return min(1.0, energy / max(self._threshold_hint, 1e-6))


def _decode_pcm16_window(window: bytes) -> list[float]:
    samples = array("h")
    samples.frombytes(window)

    if sys.byteorder != "little":
        samples.byteswap()

    return [sample / 32768.0 for sample in samples]


class VoiceActivityGate:
    """
    Stateful speech gate that buffers startup audio, suppresses silence, and
    emits a pause signal when a speech segment ends.
    """

    _SILENCE_HYSTERESIS = 0.15

    def __init__(self, backend: ProbabilityBackend, config: VADConfig) -> None:
        self._backend = backend
        self._config = config
        self._window_bytes = config.window_size_samples * 2
        self._min_speech_samples = int(config.sample_rate * config.min_speech_duration_ms / 1000)
        self._min_silence_samples = int(config.sample_rate * config.min_silence_duration_ms / 1000)
        self._pre_roll_capacity = max(0, math.ceil(config.speech_pad_ms / self.window_duration_ms))
        self._pending = bytearray()
        self._pre_roll: Deque[bytes] = deque(maxlen=self._pre_roll_capacity or None)
        self._speech_buffer: list[bytes] = []
        self._speech_samples = 0
        self._silence_samples = 0
        self._speech_active = False
        self._speech_confirmed = False

    @property
    def window_duration_ms(self) -> float:
        return float(self._config.chunk_duration_ms)

    def feed(self, chunk: bytes) -> VADFrameResult:
        self._pending.extend(chunk)
        result = VADFrameResult()

        while len(self._pending) >= self._window_bytes:
            window = bytes(self._pending[: self._window_bytes])
            del self._pending[: self._window_bytes]
            self._process_window(window, result)

        return result

    def flush(self, *, force: bool = False) -> VADFrameResult:
        result = VADFrameResult()

        if self._pending and force:
            padded = bytes(self._pending).ljust(self._window_bytes, b"\x00")
            self._pending.clear()
            self._process_window(padded, result, final_window=True)
        else:
            self._pending.clear()

        if self._speech_active:
            if force and not self._speech_confirmed and self._speech_buffer:
                result.forwarded_chunks.extend(self._speech_buffer)
                result.speech_confirmed = True
            if force:
                result.speech_ended = self._speech_confirmed or bool(self._speech_buffer)

            self._reset_segment()

        self._pre_roll.clear()
        return result

    def _process_window(self, window: bytes, result: VADFrameResult, *, final_window: bool = False) -> None:
        samples = _decode_pcm16_window(window)
        probability = self._backend.predict(window, samples)

        if not self._speech_active:
            if self._pre_roll_capacity > 0:
                self._pre_roll.append(window)

            if probability >= self._config.threshold:
                self._speech_active = True
                result.speech_started = True

                self._speech_buffer = list(self._pre_roll)
                self._speech_samples = len(self._speech_buffer) * self._config.window_size_samples
                self._silence_samples = 0
                self._pre_roll.clear()

                if self._speech_samples >= self._min_speech_samples:
                    self._speech_confirmed = True
                    result.speech_confirmed = True
                    result.forwarded_chunks.extend(self._speech_buffer)
                    self._speech_buffer.clear()
            return

        if self._speech_confirmed:
            result.forwarded_chunks.append(window)
        else:
            self._speech_buffer.append(window)
            self._speech_samples += self._config.window_size_samples
            if self._speech_samples >= self._min_speech_samples:
                self._speech_confirmed = True
                result.speech_confirmed = True
                result.forwarded_chunks.extend(self._speech_buffer)
                self._speech_buffer.clear()

        silence_threshold = self._config.threshold - self._SILENCE_HYSTERESIS
        if probability < silence_threshold:
            self._silence_samples += self._config.window_size_samples
        else:
            self._silence_samples = 0

        if self._silence_samples >= self._min_silence_samples:
            if self._speech_confirmed:
                result.speech_ended = True
            self._reset_segment()

    def _reset_segment(self) -> None:
        self._speech_active = False
        self._speech_confirmed = False
        self._speech_buffer = []
        self._speech_samples = 0
        self._silence_samples = 0


def build_voice_activity_gate(config: VADConfig) -> VoiceActivityGate:
    try:
        backend = WebRtcVadBackend(
            sample_rate=config.sample_rate,
            aggressiveness=config.aggressiveness
        )
        backend.load()
        logger.info("WebRTC VAD backend loaded")
    except Exception as exc:
        logger.warning("WebRTC VAD unavailable, using energy fallback: %s", exc)
        backend = EnergyProbabilityBackend()

    return VoiceActivityGate(backend=backend, config=config)
