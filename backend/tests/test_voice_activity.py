from array import array
import unittest

from app.services.voice_activity import VADConfig, VADFrameResult, VoiceActivityGate


def make_window(value: int, window_size_samples: int = 512) -> bytes:
    samples = array("h", [value] * window_size_samples)
    return samples.tobytes()


class ScriptedBackend:
    def __init__(self, probabilities: list[float]) -> None:
        self._probabilities = probabilities
        self._index = 0

    def predict(self, samples) -> float:
        probability = self._probabilities[self._index]
        self._index += 1
        return probability


class VoiceActivityGateTests(unittest.TestCase):
    def test_forwards_speech_and_suppresses_silence(self) -> None:
        gate = VoiceActivityGate(
            backend=ScriptedBackend([0.9, 0.92, 0.1, 0.08, 0.05, 0.02, 0.01]),
            config=VADConfig(
                threshold=0.5,
                min_speech_duration_ms=0,
                min_silence_duration_ms=100,
                speech_pad_ms=0,
            ),
        )

        outputs = []
        for index in range(7):
            outputs.append(gate.feed(make_window(index + 1)))

        forwarded = [chunk for output in outputs for chunk in output.forwarded_chunks]
        self.assertLess(len(forwarded), 7)
        self.assertTrue(any(output.speech_ended for output in outputs))

    def test_requires_min_speech_before_forwarding(self) -> None:
        gate = VoiceActivityGate(
            backend=ScriptedBackend([0.9, 0.9, 0.1, 0.1, 0.1, 0.1]),
            config=VADConfig(
                threshold=0.5,
                min_speech_duration_ms=250,
                min_silence_duration_ms=100,
                speech_pad_ms=0,
            ),
        )

        outputs = []
        for index in range(6):
            outputs.append(gate.feed(make_window(index + 1)))

        self.assertTrue(all(not item.forwarded_chunks for item in outputs))
        self.assertFalse(any(item.speech_ended for item in outputs))

    def test_force_flush_releases_pending_short_segment(self) -> None:
        gate = VoiceActivityGate(
            backend=ScriptedBackend([0.9, 0.9, 0.1, 0.1, 0.1, 0.1]),
            config=VADConfig(
                threshold=0.5,
                min_speech_duration_ms=250,
                min_silence_duration_ms=100,
                speech_pad_ms=0,
            ),
        )

        for index in range(2):
            gate.feed(make_window(index + 1))

        flushed = gate.flush(force=True)

        self.assertGreater(len(flushed.forwarded_chunks), 0)
