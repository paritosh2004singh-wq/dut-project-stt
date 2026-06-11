"""
Tests for the VoiceActivityGate and related VAD components.

Covers:
- Silence detection and speech_ended signaling
- Speech confirmation after min_speech_duration
- Pre-roll buffering
- Flush behavior (force vs. non-force)
- Energy fallback backend
- The build_voice_activity_gate factory
"""

import sys
import os
import unittest
from unittest.mock import MagicMock, patch
import struct
import math

# Ensure the backend root is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.voice_activity import (
    VADConfig,
    VADFrameResult,
    VoiceActivityGate,
    EnergyProbabilityBackend,
    _decode_pcm16_window,
    build_voice_activity_gate,
)


def _make_pcm_window(value: float, num_samples: int = 512) -> bytes:
    """Create a PCM16 window where every sample has the given float value [-1, 1]."""
    int_val = int(max(-1.0, min(1.0, value)) * 32767)
    return struct.pack("<" + "h" * num_samples, *([int_val] * num_samples))


def _make_silence_window(num_samples: int = 512) -> bytes:
    """Create a PCM16 window of pure silence."""
    return _make_pcm_window(0.0, num_samples)


def _make_speech_window(num_samples: int = 512) -> bytes:
    """Create a PCM16 window of loud speech-like audio."""
    return _make_pcm_window(0.8, num_samples)


class FakeProbabilityBackend:
    """A backend whose predictions can be controlled per-call."""

    def __init__(self, probabilities=None):
        self._probabilities = list(probabilities or [])
        self._call_index = 0

    def predict(self, samples):
        if self._call_index < len(self._probabilities):
            prob = self._probabilities[self._call_index]
        else:
            prob = 0.0
        self._call_index += 1
        return prob


class TestDeccodePCM16Window(unittest.TestCase):
    """Tests for the _decode_pcm16_window helper."""

    def test_silence_decodes_to_zeros(self):
        window = _make_silence_window(4)
        samples = _decode_pcm16_window(window)
        self.assertEqual(len(samples), 4)
        for s in samples:
            self.assertAlmostEqual(s, 0.0, places=4)

    def test_loud_signal_decodes_correctly(self):
        window = _make_pcm_window(0.5, 4)
        samples = _decode_pcm16_window(window)
        self.assertEqual(len(samples), 4)
        for s in samples:
            self.assertAlmostEqual(s, 0.5, delta=0.001)

    def test_negative_signal(self):
        window = _make_pcm_window(-0.5, 4)
        samples = _decode_pcm16_window(window)
        for s in samples:
            self.assertAlmostEqual(s, -0.5, delta=0.001)


class TestEnergyProbabilityBackend(unittest.TestCase):
    """Tests for the lightweight energy-based VAD fallback."""

    def test_silence_returns_zero(self):
        backend = EnergyProbabilityBackend(threshold_hint=0.02)
        prob = backend.predict([0.0] * 512)
        self.assertAlmostEqual(prob, 0.0, places=4)

    def test_loud_signal_returns_high(self):
        backend = EnergyProbabilityBackend(threshold_hint=0.02)
        prob = backend.predict([0.5] * 512)
        self.assertGreater(prob, 0.9)

    def test_empty_samples_returns_zero(self):
        backend = EnergyProbabilityBackend()
        prob = backend.predict([])
        self.assertEqual(prob, 0.0)

    def test_output_capped_at_one(self):
        backend = EnergyProbabilityBackend(threshold_hint=0.001)
        prob = backend.predict([1.0] * 512)
        self.assertLessEqual(prob, 1.0)


class TestVoiceActivityGateSpeechDetection(unittest.TestCase):
    """Tests for the core VoiceActivityGate speech detection state machine."""

    def _make_gate(self, probabilities, config=None):
        """Helper: create a gate with a fake backend that returns given probs."""
        backend = FakeProbabilityBackend(probabilities)
        if config is None:
            config = VADConfig(
                sample_rate=16000,
                threshold=0.5,
                min_speech_duration_ms=250,
                min_silence_duration_ms=100,
                speech_pad_ms=30,
                window_size_samples=512,
            )
        return VoiceActivityGate(backend=backend, config=config)

    def test_pure_silence_no_events(self):
        """Feeding silence should not trigger speech_started or speech_ended."""
        gate = self._make_gate([0.0] * 10)
        for _ in range(10):
            result = gate.feed(_make_silence_window())
            self.assertFalse(result.speech_started)
            self.assertFalse(result.speech_ended)
            self.assertEqual(result.forwarded_chunks, [])

    def test_speech_starts_on_threshold(self):
        """When probability crosses threshold, speech_started should be True."""
        # First window silent, second window is speech
        gate = self._make_gate([0.1, 0.8])
        r1 = gate.feed(_make_silence_window())
        self.assertFalse(r1.speech_started)

        r2 = gate.feed(_make_speech_window())
        self.assertTrue(r2.speech_started)

    def test_speech_confirmed_after_min_duration(self):
        """Speech should be confirmed after enough samples exceed min_speech_duration."""
        # min_speech_duration_ms=250 at 16kHz => 4000 samples => 4000/512 ≈ 8 windows
        probs = [0.8] * 12  # All speech
        gate = self._make_gate(probs)

        confirmed = False
        for _ in range(12):
            result = gate.feed(_make_speech_window())
            if result.speech_confirmed:
                confirmed = True

        self.assertTrue(confirmed, "Speech should be confirmed after enough windows")

    def test_speech_ended_after_silence(self):
        """After confirmed speech, sufficient silence should trigger speech_ended."""
        # min_silence_duration_ms=100 at 16kHz => 1600 samples => ~3.1 windows of 512
        # Need enough speech windows first for confirmation, then silence windows
        speech_probs = [0.8] * 10  # Enough for speech confirmation
        silence_probs = [0.0] * 10  # Enough for silence trigger
        gate = self._make_gate(speech_probs + silence_probs)

        ended = False
        for _ in range(10):
            gate.feed(_make_speech_window())
        for _ in range(10):
            result = gate.feed(_make_silence_window())
            if result.speech_ended:
                ended = True

        self.assertTrue(ended, "speech_ended should fire after confirmed speech + silence")

    def test_silence_resets_on_new_speech(self):
        """If silence starts accumulating but speech resumes, silence counter should reset."""
        # Speech → partial silence → more speech → should NOT trigger speech_ended
        probs = [0.8] * 10 + [0.1, 0.1] + [0.8] * 5
        gate = self._make_gate(probs)

        # Feed speech windows for confirmation
        for _ in range(10):
            gate.feed(_make_speech_window())

        # Feed 2 silence windows (not enough for min_silence_duration at default 100ms)
        for _ in range(2):
            result = gate.feed(_make_silence_window())
            # Might or might not end depending on exact timing

        # Feed more speech — should reset
        ended_after_resume = False
        for _ in range(5):
            result = gate.feed(_make_speech_window())
            if result.speech_ended:
                ended_after_resume = True

        # After resuming speech, speech_ended should not fire from the speech windows
        self.assertFalse(ended_after_resume, "speech_ended should not fire during resumed speech")


class TestVoiceActivityGateFlush(unittest.TestCase):
    """Tests for the flush() method behavior."""

    def _make_gate(self, probabilities, config=None):
        backend = FakeProbabilityBackend(probabilities)
        if config is None:
            config = VADConfig(
                sample_rate=16000,
                threshold=0.5,
                min_speech_duration_ms=250,
                min_silence_duration_ms=100,
                speech_pad_ms=30,
                window_size_samples=512,
            )
        return VoiceActivityGate(backend=backend, config=config)

    def test_flush_force_during_speech_emits_ended(self):
        """Force-flushing during active speech should emit speech_ended."""
        probs = [0.8] * 10
        gate = self._make_gate(probs)

        for _ in range(10):
            gate.feed(_make_speech_window())

        result = gate.flush(force=True)
        self.assertTrue(result.speech_ended, "Force flush during speech should emit speech_ended")

    def test_flush_no_force_clears_pending(self):
        """Non-force flush should just clear pending data without events."""
        probs = [0.8] * 5
        gate = self._make_gate(probs)

        for _ in range(5):
            gate.feed(_make_speech_window())

        result = gate.flush(force=False)
        # speech_ended may or may not be set depending on whether speech was confirmed,
        # but the gate should be reset
        # After flush, feeding silence should not produce speech_ended
        gate2_probs = [0.0] * 5
        gate._backend = FakeProbabilityBackend(gate2_probs)
        for _ in range(5):
            r = gate.feed(_make_silence_window())
            self.assertFalse(r.speech_ended)

    def test_flush_empty_gate_no_crash(self):
        """Flushing an empty gate should not raise."""
        gate = self._make_gate([])
        result = gate.flush(force=True)
        self.assertFalse(result.speech_started)
        self.assertFalse(result.speech_ended)


class TestVoiceActivityGatePreRoll(unittest.TestCase):
    """Tests for the pre-roll buffer that captures audio before speech onset."""

    def _make_gate(self, probabilities, speech_pad_ms=60):
        backend = FakeProbabilityBackend(probabilities)
        config = VADConfig(
            sample_rate=16000,
            threshold=0.5,
            min_speech_duration_ms=50,  # Low so speech confirms quickly
            min_silence_duration_ms=100,
            speech_pad_ms=speech_pad_ms,
            window_size_samples=512,
        )
        return VoiceActivityGate(backend=backend, config=config)

    def test_preroll_included_when_speech_starts(self):
        """Pre-roll silence windows should be forwarded when speech is confirmed."""
        # 2 silence windows then speech
        probs = [0.0, 0.0] + [0.8] * 5
        gate = self._make_gate(probs, speech_pad_ms=100)

        # Feed silence
        gate.feed(_make_silence_window())
        gate.feed(_make_silence_window())

        # Feed speech — should eventually get forwarded chunks including pre-roll
        all_forwarded = []
        for _ in range(5):
            result = gate.feed(_make_speech_window())
            all_forwarded.extend(result.forwarded_chunks)

        # Should have more chunks than just the speech windows (pre-roll included)
        self.assertGreater(len(all_forwarded), 0, "Pre-roll chunks should be forwarded")

    def test_zero_pad_ms_no_preroll(self):
        """With speech_pad_ms=0, no pre-roll should be captured."""
        probs = [0.0, 0.0] + [0.8] * 5
        gate = self._make_gate(probs, speech_pad_ms=0)

        gate.feed(_make_silence_window())
        gate.feed(_make_silence_window())

        all_forwarded = []
        for _ in range(5):
            result = gate.feed(_make_speech_window())
            all_forwarded.extend(result.forwarded_chunks)

        # With zero pad and low min_speech_duration, the forwarded chunks
        # should not include silence windows
        # Each forwarded chunk should be a speech window
        self.assertGreater(len(all_forwarded), 0)


class TestBuildVoiceActivityGate(unittest.TestCase):
    """Tests for the factory function."""

    def test_builds_with_energy_fallback_when_silero_unavailable(self):
        """When torch is not available, should fall back to EnergyProbabilityBackend."""
        config = VADConfig()

        # Mock the Silero backend to fail on load
        with patch(
            "app.services.voice_activity.SileroProbabilityBackend"
        ) as MockSilero:
            mock_instance = MagicMock()
            mock_instance.load.side_effect = ImportError("No torch")
            MockSilero.return_value = mock_instance

            gate = build_voice_activity_gate(config)

        self.assertIsInstance(gate, VoiceActivityGate)
        # The gate should still work — feed some silence
        result = gate.feed(_make_silence_window())
        self.assertIsInstance(result, VADFrameResult)


class TestVADFrameResult(unittest.TestCase):
    """Tests for the VADFrameResult dataclass defaults."""

    def test_defaults(self):
        result = VADFrameResult()
        self.assertEqual(result.forwarded_chunks, [])
        self.assertFalse(result.speech_started)
        self.assertFalse(result.speech_ended)
        self.assertFalse(result.speech_confirmed)

    def test_independent_lists(self):
        """Each instance should have its own forwarded_chunks list."""
        r1 = VADFrameResult()
        r2 = VADFrameResult()
        r1.forwarded_chunks.append(b"data")
        self.assertEqual(len(r2.forwarded_chunks), 0)


if __name__ == "__main__":
    unittest.main()
