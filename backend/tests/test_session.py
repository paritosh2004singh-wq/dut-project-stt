"""
Tests for the TranscriptionSession class.

Covers:
- VAD gate integration (feed_audio dispatches forwarded chunks and speech_ended)
- Session close flushes the VAD gate and publishes disconnect
- Redis interactions are mocked
"""

import sys
import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
import asyncio
import struct

# Ensure the backend root is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.voice_activity import VADFrameResult


def _make_pcm_window(value: float, num_samples: int = 512) -> bytes:
    """Create a PCM16 window where every sample has the given float value."""
    int_val = int(max(-1.0, min(1.0, value)) * 32767)
    return struct.pack("<" + "h" * num_samples, *([int_val] * num_samples))


class TestSessionFeedAudio(unittest.TestCase):
    """Tests for TranscriptionSession.feed_audio behavior."""

    def test_feed_audio_publishes_forwarded_chunks(self):
        """When VAD gate forwards chunks, they should be published to Redis."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            with patch("app.services.session.redis_client") as mock_redis, \
                 patch("app.services.session.publish_audio_chunk", new_callable=AsyncMock) as mock_publish, \
                 patch("app.services.session.build_voice_activity_gate") as mock_build_vag:

                # Setup VAD gate mock to return forwarded chunks
                mock_gate = MagicMock()
                gate_result = VADFrameResult()
                gate_result.forwarded_chunks = [b"chunk1", b"chunk2"]
                gate_result.speech_ended = False
                mock_gate.feed.return_value = gate_result
                mock_build_vag.return_value = mock_gate

                # Mock Redis pubsub
                mock_pubsub = MagicMock()
                mock_pubsub.subscribe = AsyncMock()
                mock_pubsub.listen = MagicMock(return_value=AsyncMock())
                mock_redis.pubsub.return_value = mock_pubsub

                # Import here to pick up the mocks
                from app.services.session import TranscriptionSession

                mock_ws = MagicMock()
                session = TranscriptionSession(
                    mock_ws,
                    session_id="test-session-123",
                    target_language="English",
                )

                # Feed audio
                loop.run_until_complete(session.feed_audio(b"raw_audio_data"))

                # Should have published 2 chunks
                self.assertEqual(mock_publish.call_count, 2)

                # Verify session_id is passed correctly
                for call in mock_publish.call_args_list:
                    self.assertEqual(call.kwargs.get("session_id") or call[1].get("session_id", call[0][0] if call[0] else None), "test-session-123")

        finally:
            loop.close()

    def test_feed_audio_publishes_speech_ended_event(self):
        """When VAD gate signals speech_ended, a speech_ended event should be published."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            with patch("app.services.session.redis_client") as mock_redis, \
                 patch("app.services.session.publish_audio_chunk", new_callable=AsyncMock) as mock_publish, \
                 patch("app.services.session.build_voice_activity_gate") as mock_build_vag:

                mock_gate = MagicMock()
                gate_result = VADFrameResult()
                gate_result.forwarded_chunks = []
                gate_result.speech_ended = True
                mock_gate.feed.return_value = gate_result
                mock_build_vag.return_value = mock_gate

                mock_pubsub = MagicMock()
                mock_pubsub.subscribe = AsyncMock()
                mock_redis.pubsub.return_value = mock_pubsub
                mock_redis.xadd = AsyncMock()

                from app.services.session import TranscriptionSession

                mock_ws = MagicMock()
                session = TranscriptionSession(
                    mock_ws,
                    session_id="test-session-456",
                    target_language="Hindi",
                )

                loop.run_until_complete(session.feed_audio(b"audio"))

                # xadd should have been called with speech_ended event
                mock_redis.xadd.assert_called_once()
                call_args = mock_redis.xadd.call_args
                self.assertEqual(call_args[0][0], "audio_stream")
                self.assertEqual(call_args[0][1]["event"], "speech_ended")
                self.assertEqual(call_args[0][1]["session_id"], "test-session-456")

        finally:
            loop.close()

    def test_feed_audio_no_forwarded_no_publish(self):
        """When VAD gate forwards nothing and no events, nothing should be published."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            with patch("app.services.session.redis_client") as mock_redis, \
                 patch("app.services.session.publish_audio_chunk", new_callable=AsyncMock) as mock_publish, \
                 patch("app.services.session.build_voice_activity_gate") as mock_build_vag:

                mock_gate = MagicMock()
                gate_result = VADFrameResult()
                gate_result.forwarded_chunks = []
                gate_result.speech_ended = False
                mock_gate.feed.return_value = gate_result
                mock_build_vag.return_value = mock_gate

                mock_pubsub = MagicMock()
                mock_pubsub.subscribe = AsyncMock()
                mock_redis.pubsub.return_value = mock_pubsub
                mock_redis.xadd = AsyncMock()

                from app.services.session import TranscriptionSession

                mock_ws = MagicMock()
                session = TranscriptionSession(
                    mock_ws,
                    session_id="test-session-789",
                )

                loop.run_until_complete(session.feed_audio(b"quiet_audio"))

                mock_publish.assert_not_called()
                mock_redis.xadd.assert_not_called()

        finally:
            loop.close()


class TestSessionClose(unittest.TestCase):
    """Tests for TranscriptionSession.close behavior."""

    def test_close_flushes_vad_and_publishes_disconnect(self):
        """Closing the session should flush VAD gate and publish a disconnect event."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            with patch("app.services.session.redis_client") as mock_redis, \
                 patch("app.services.session.publish_audio_chunk", new_callable=AsyncMock) as mock_publish, \
                 patch("app.services.session.build_voice_activity_gate") as mock_build_vag:

                # Setup VAD gate to return some chunks on flush
                mock_gate = MagicMock()
                flush_result = VADFrameResult()
                flush_result.forwarded_chunks = [b"final_chunk"]
                flush_result.speech_ended = True
                mock_gate.flush.return_value = flush_result
                mock_build_vag.return_value = mock_gate

                # Setup Redis mock
                mock_pubsub = MagicMock()
                mock_pubsub.subscribe = AsyncMock()
                mock_pubsub.unsubscribe = AsyncMock()
                mock_redis.pubsub.return_value = mock_pubsub
                mock_redis.xadd = AsyncMock()

                from app.services.session import TranscriptionSession

                mock_ws = MagicMock()
                session = TranscriptionSession(
                    mock_ws,
                    session_id="test-close-session",
                    target_language="Kannada",
                )
                session._listener_task = None  # No listener running
                # Directly assign pubsub mock to avoid coroutine chain issues
                session._pubsub = mock_pubsub

                loop.run_until_complete(session.close())

                # VAD gate should have been flushed with force=True
                mock_gate.flush.assert_called_once_with(force=True)

                # Final chunk should have been published
                self.assertEqual(mock_publish.call_count, 1)

                # Disconnect event should have been published
                xadd_calls = mock_redis.xadd.call_args_list
                disconnect_calls = [
                    c for c in xadd_calls
                    if c[0][1].get("event") == "disconnect"
                ]
                self.assertEqual(len(disconnect_calls), 1)
                self.assertEqual(
                    disconnect_calls[0][0][1]["session_id"],
                    "test-close-session"
                )

                # Pubsub should have been unsubscribed
                mock_pubsub.unsubscribe.assert_called_once()

        finally:
            loop.close()

    def test_close_cancels_listener_task(self):
        """Closing should cancel the listener task if it exists."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            with patch("app.services.session.redis_client") as mock_redis, \
                 patch("app.services.session.publish_audio_chunk", new_callable=AsyncMock), \
                 patch("app.services.session.build_voice_activity_gate") as mock_build_vag:

                mock_gate = MagicMock()
                flush_result = VADFrameResult()
                flush_result.forwarded_chunks = []
                mock_gate.flush.return_value = flush_result
                mock_build_vag.return_value = mock_gate

                mock_pubsub = MagicMock()
                mock_pubsub.subscribe = AsyncMock()
                mock_pubsub.unsubscribe = AsyncMock()
                mock_redis.pubsub.return_value = mock_pubsub
                mock_redis.xadd = AsyncMock()

                from app.services.session import TranscriptionSession

                mock_ws = MagicMock()
                session = TranscriptionSession(
                    mock_ws,
                    session_id="test-listener-cancel",
                )
                # Directly assign pubsub mock to avoid coroutine chain issues
                session._pubsub = mock_pubsub

                # Create a mock task
                mock_task = MagicMock()
                mock_task.cancel = MagicMock()
                session._listener_task = mock_task

                loop.run_until_complete(session.close())

                mock_task.cancel.assert_called_once()

        finally:
            loop.close()


class TestSessionSequenceCounter(unittest.TestCase):
    """Tests for the per-session sequence counter."""

    def test_sequence_increments_per_chunk(self):
        """Each forwarded chunk should increment the sequence counter."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            with patch("app.services.session.redis_client") as mock_redis, \
                 patch("app.services.session.publish_audio_chunk", new_callable=AsyncMock) as mock_publish, \
                 patch("app.services.session.build_voice_activity_gate") as mock_build_vag:

                mock_gate = MagicMock()
                gate_result = VADFrameResult()
                gate_result.forwarded_chunks = [b"c1", b"c2", b"c3"]
                gate_result.speech_ended = False
                mock_gate.feed.return_value = gate_result
                mock_build_vag.return_value = mock_gate

                mock_pubsub = MagicMock()
                mock_pubsub.subscribe = AsyncMock()
                mock_redis.pubsub.return_value = mock_pubsub

                from app.services.session import TranscriptionSession

                mock_ws = MagicMock()
                session = TranscriptionSession(
                    mock_ws,
                    session_id="test-seq",
                )

                loop.run_until_complete(session.feed_audio(b"data"))

                # Sequence should be 1, 2, 3 for the 3 chunks
                sequences = [
                    call.kwargs.get("sequence") or call[1].get("sequence", call[0][2] if len(call[0]) > 2 else None)
                    for call in mock_publish.call_args_list
                ]
                self.assertEqual(sequences, [1, 2, 3])

        finally:
            loop.close()


if __name__ == "__main__":
    unittest.main()
