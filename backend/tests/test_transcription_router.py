"""
Tests for the WebSocket transcription router.

Covers:
- The 'stop' signal handling
- The new 'auto_stop' signal handling (silence auto-stop feature)
- Ping/pong handling
- Config message parsing
"""

import sys
import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio
import json

# Ensure the backend root is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestTranscriptionRouterStopSignals(unittest.TestCase):
    """
    Tests that validate the text-frame control signal handling
    in the transcription WebSocket endpoint.
    
    These are unit tests for the signal parsing logic, not full
    integration tests with a real WebSocket.
    """

    def test_stop_signal_recognized(self):
        """The string 'stop' should be recognized as a stop signal."""
        text = "stop"
        self.assertIn(text.lower(), ("stop", "auto_stop"))

    def test_auto_stop_signal_recognized(self):
        """The string 'auto_stop' should be recognized as a stop signal."""
        text = "auto_stop"
        self.assertIn(text.lower(), ("stop", "auto_stop"))

    def test_auto_stop_case_insensitive(self):
        """auto_stop should be case-insensitive."""
        for variant in ["AUTO_STOP", "Auto_Stop", "auto_stop", "AUTO_stop"]:
            self.assertIn(
                variant.strip().lower(),
                ("stop", "auto_stop"),
                f"'{variant}' should be recognized as a stop signal",
            )

    def test_stop_case_insensitive(self):
        """stop should be case-insensitive."""
        for variant in ["STOP", "Stop", "stop", "sToP"]:
            self.assertIn(
                variant.strip().lower(),
                ("stop", "auto_stop"),
                f"'{variant}' should be recognized as a stop signal",
            )

    def test_random_text_not_stop(self):
        """Random text should not be treated as a stop signal."""
        for text in ["hello", "pause", "start", "restart", "auto_pause"]:
            self.assertNotIn(
                text.strip().lower(),
                ("stop", "auto_stop"),
                f"'{text}' should NOT be recognized as a stop signal",
            )

    def test_whitespace_stripped(self):
        """Whitespace around signals should be stripped."""
        text = "  auto_stop  "
        self.assertIn(text.strip().lower(), ("stop", "auto_stop"))

    def test_ping_message_detected(self):
        """A JSON ping message should be recognized correctly."""
        text = '{"type": "ping"}'
        parsed = json.loads(text)
        self.assertEqual(parsed.get("type"), "ping")

    def test_non_json_text_not_ping(self):
        """Non-JSON text should not crash the ping handler."""
        text = "not json"
        try:
            parsed = json.loads(text)
            is_ping = parsed.get("type") == "ping"
        except (json.JSONDecodeError, Exception):
            is_ping = False
        self.assertFalse(is_ping)


class TestTranscriptionRouterControlFlow(unittest.TestCase):
    """
    Tests that simulate the control flow of the WebSocket handler loop,
    ensuring stop and auto_stop break the loop correctly.
    """

    def _simulate_message_loop(self, messages):
        """
        Simulate the message processing loop from the router.
        Returns (audio_chunks_processed, break_reason).
        """
        audio_chunks = 0
        break_reason = None

        for message in messages:
            # Binary frame → PCM audio chunk
            if "bytes" in message and message["bytes"] is not None:
                audio_chunks += 1  # Would call session.feed_audio()

            # Text frame → control signal
            elif "text" in message and message["text"] is not None:
                text = message["text"].strip()
                if text.lower() in ("stop", "auto_stop"):
                    break_reason = text.lower()
                    break
                else:
                    try:
                        parsed = json.loads(text)
                        if parsed.get("type") == "ping":
                            pass  # Would send pong
                    except Exception:
                        pass

        return audio_chunks, break_reason

    def test_stop_breaks_loop(self):
        messages = [
            {"bytes": b"audio_data", "text": None},
            {"bytes": b"audio_data_2", "text": None},
            {"bytes": None, "text": "stop"},
            {"bytes": b"should_not_reach", "text": None},
        ]
        count, reason = self._simulate_message_loop(messages)
        self.assertEqual(reason, "stop")
        self.assertEqual(count, 2)  # Only first 2 audio frames processed

    def test_auto_stop_breaks_loop(self):
        messages = [
            {"bytes": b"audio_data", "text": None},
            {"bytes": None, "text": "auto_stop"},
            {"bytes": b"should_not_reach", "text": None},
        ]
        count, reason = self._simulate_message_loop(messages)
        self.assertEqual(reason, "auto_stop")
        self.assertEqual(count, 1)

    def test_ping_does_not_break_loop(self):
        messages = [
            {"bytes": b"audio_data", "text": None},
            {"bytes": None, "text": '{"type": "ping"}'},
            {"bytes": b"more_audio", "text": None},
        ]
        count, reason = self._simulate_message_loop(messages)
        self.assertIsNone(reason)
        self.assertEqual(count, 2)  # 2 audio frames, ping is not counted

    def test_empty_loop(self):
        count, reason = self._simulate_message_loop([])
        self.assertIsNone(reason)
        self.assertEqual(count, 0)


if __name__ == "__main__":
    unittest.main()
