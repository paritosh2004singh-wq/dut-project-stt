from __future__ import annotations

import asyncio
import logging
import uuid
from fastapi import WebSocket

from app.core.redis import publish_audio_chunk, redis_client
from app.models.messages import SessionRestoredMessage
from app.services.voice_activity import VADConfig, build_voice_activity_gate
from app.core.config import settings

logger = logging.getLogger(__name__)

class TranscriptionSession:
    def __init__(
        self,
        websocket: WebSocket,
        *,
        session_id: str | None = None,
        fast_delay_ms: int = 240, # Kept for API compatibility
        slow_delay_ms: int = 2400,
        sample_rate: int = 16000,
        chunk_duration_ms: int = 10,
        target_language: str = "English",
        vad_threshold: float = settings.vad_threshold,
        vad_min_speech_ms: int = settings.vad_min_speech_ms,
        vad_min_silence_ms: int = settings.vad_min_silence_ms,
        vad_speech_pad_ms: int = settings.vad_speech_pad_ms,
        vad_aggressiveness: int = settings.vad_aggressiveness,
        **kwargs
    ) -> None:
        self._ws = websocket
        self._session_id = session_id or str(uuid.uuid4())
        self._target_language = target_language
        self._vad_gate = build_voice_activity_gate(
            VADConfig(
                sample_rate=sample_rate,
                chunk_duration_ms=chunk_duration_ms,
                threshold=vad_threshold,
                min_speech_duration_ms=vad_min_speech_ms,
                min_silence_duration_ms=vad_min_silence_ms,
                speech_pad_ms=vad_speech_pad_ms,
                aggressiveness=vad_aggressiveness,
            )
        )
        self._pubsub = redis_client.pubsub()
        self._listener_task = None
        self._sequence = 0

    async def start(self) -> None:
        await self._pubsub.subscribe(f"results:{self._session_id}")
        self._listener_task = asyncio.create_task(self._listen_results())

    async def feed_audio(self, chunk: bytes) -> None:
        gate_result = self._vad_gate.feed(chunk)

        for forwarded_chunk in gate_result.forwarded_chunks:
            self._sequence += 1
            await publish_audio_chunk(
                session_id=self._session_id,
                chunk=forwarded_chunk,
                sequence=self._sequence,
                target_language=self._target_language
            )

        if gate_result.speech_ended:
            await redis_client.xadd("audio_stream", {
                "session_id": self._session_id,
                "event": "speech_ended"
            })

    async def _listen_results(self) -> None:
        try:
            async for message in self._pubsub.listen():
                if message["type"] == "message":
                    payload = message["data"]
                    await self._ws.send_text(payload)
        except Exception as e:
            logger.error(f"Pubsub listen error: {e}")

    async def close(self) -> None:
        gate_result = self._vad_gate.flush(force=True)
        
        for forwarded_chunk in gate_result.forwarded_chunks:
            self._sequence += 1
            await publish_audio_chunk(
                session_id=self._session_id,
                chunk=forwarded_chunk,
                sequence=self._sequence,
                target_language=self._target_language
            )

        await redis_client.xadd("audio_stream", {
            "session_id": self._session_id,
            "event": "disconnect"
        })
        
        if self._listener_task:
            self._listener_task.cancel()
        await self._pubsub.unsubscribe(f"results:{self._session_id}")
