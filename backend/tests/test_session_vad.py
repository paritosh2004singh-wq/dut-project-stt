from __future__ import annotations

import asyncio
import json
import unittest
from dataclasses import dataclass

from app.models.messages import TranscriptMessage
from app.services.session import TranscriptionSession


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent_messages: list[str] = []

    async def send_text(self, text: str) -> None:
        self.sent_messages.append(text)


class FakeBroadcaster:
    def __init__(self) -> None:
        self.forwarded: list[bytes] = []
        self.stopped = False

    async def put(self, chunk: bytes) -> None:
        self.forwarded.append(chunk)

    async def stop(self) -> None:
        self.stopped = True

    @property
    def fast_queue_index(self) -> int:
        return 0

    @property
    def slow_queue_index(self) -> int:
        return 1

    def iter_stream(self, index: int):
        async def _generator():
            if False:
                yield b""

        return _generator()


class FakeVadGate:
    def __init__(self) -> None:
        self.feed_calls: list[bytes] = []
        self.flush_called = False

    def feed(self, chunk: bytes):
        self.feed_calls.append(chunk)

        class Result:
            forwarded_chunks = [chunk]
            speech_ended = True

        return Result()

    def flush(self, *, force: bool = False):
        self.flush_called = True

        class Result:
            forwarded_chunks = []
            speech_ended = False

        return Result()


async def fake_translator(*, transcription: str, target_language: str):
    return {
        "success": True,
        "translated_text": f"translated:{transcription}:{target_language}",
    }


class SessionVadTests(unittest.IsolatedAsyncioTestCase):
    async def test_feed_audio_signals_pause_and_forwards_speech(self) -> None:
        websocket = FakeWebSocket()
        broadcaster = FakeBroadcaster()
        vad_gate = FakeVadGate()

        session = TranscriptionSession(
            websocket,
            fast_delay_ms=240,
            slow_delay_ms=2400,
            sample_rate=16000,
            target_language="Hindi",
            broadcaster=broadcaster,
            vad_gate=vad_gate,
            translator=fake_translator,
            client_factory=lambda **kwargs: object(),
            stream_runner=lambda **kwargs: asyncio.sleep(0),
        )

        await session.feed_audio(b"abc")

        self.assertEqual(broadcaster.forwarded, [b"abc"])
        self.assertFalse(session._translation_signal_queue.empty())

    async def test_close_cleans_confirmed_text_before_translation(self) -> None:
        websocket = FakeWebSocket()
        broadcaster = FakeBroadcaster()
        vad_gate = FakeVadGate()

        session = TranscriptionSession(
            websocket,
            fast_delay_ms=240,
            slow_delay_ms=2400,
            sample_rate=16000,
            target_language="Hindi",
            broadcaster=broadcaster,
            vad_gate=vad_gate,
            translator=fake_translator,
            client_factory=lambda **kwargs: object(),
            stream_runner=lambda **kwargs: asyncio.sleep(0),
        )

        session._state.fast_full_text = "Um hello hello"
        session._state.slow_full_text = "Um hello hello"
        session._state.fast_done = True
        session._state.slow_done = True

        await session.close()

        transcript_messages = [
            json.loads(message)
            for message in websocket.sent_messages
            if json.loads(message).get("type") == "transcript"
        ]

        self.assertTrue(transcript_messages)
        self.assertEqual(transcript_messages[-1]["confirmed_text"], "hello")
        self.assertEqual(transcript_messages[-1]["translated_text"], "translated:hello:Hindi")
