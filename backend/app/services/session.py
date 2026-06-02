from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable

from fastapi import WebSocket
from mistralai.client import Mistral
from mistralai.client.models import AudioFormat

from app.core.config import settings
from app.models.messages import (
    ErrorMessage,
    StatusKind,
    StatusMessage,
    StreamKind,
    TranscriptMessage,
)
from app.services.audio_broadcaster import AudioBroadcaster
from app.services.transcript_cleanup import clean_final_transcript
from app.services.transcript_state import TranscriptState
from app.services.transcription_runner import run_stream
from app.services.translation import translate_transcription_advanced
from app.services.voice_activity import VADConfig, VoiceActivityGate, build_voice_activity_gate

logger = logging.getLogger(__name__)


class TranscriptionSession:
    def __init__(
        self,
        websocket: WebSocket,
        *,
        fast_delay_ms: int,
        slow_delay_ms: int,
        sample_rate: int,
        target_language: str = "English",
        vad_threshold: float = settings.vad_threshold,
        vad_min_speech_ms: int = settings.vad_min_speech_ms,
        vad_min_silence_ms: int = settings.vad_min_silence_ms,
        vad_speech_pad_ms: int = settings.vad_speech_pad_ms,
        broadcaster: AudioBroadcaster | None = None,
        vad_gate: VoiceActivityGate | None = None,
        client_factory: Callable[..., Mistral] = Mistral,
        stream_runner: Callable[..., Awaitable[None]] = run_stream,
        translator: Callable[..., Awaitable[dict[str, Any]]] = translate_transcription_advanced,
    ) -> None:
        self._ws = websocket
        self._fast_delay_ms = fast_delay_ms
        self._slow_delay_ms = slow_delay_ms
        self._sample_rate = sample_rate
        self._target_language = target_language
        self._client_factory = client_factory
        self._stream_runner = stream_runner
        self._translator = translator

        self._broadcaster = broadcaster or AudioBroadcaster(n_streams=2)
        self._vad_gate = vad_gate or build_voice_activity_gate(
            VADConfig(
                sample_rate=self._sample_rate,
                threshold=vad_threshold,
                min_speech_duration_ms=vad_min_speech_ms,
                min_silence_duration_ms=vad_min_silence_ms,
                speech_pad_ms=vad_speech_pad_ms,
            )
        )
        self._state = TranscriptState()

        # update_queue: a signal (None) tells the sender loop to push state
        self._update_queue: asyncio.Queue[None] = asyncio.Queue(maxsize=1)
        self._translation_signal_queue: asyncio.Queue[None] = asyncio.Queue(maxsize=1)

        self._fast_task: asyncio.Task | None = None
        self._slow_task: asyncio.Task | None = None
        self._sender_task: asyncio.Task | None = None
        self._translation_task: asyncio.Task | None = None

        self._translated_text = ""
        self._last_translated_source = ""
        self._is_translating = False
        self._streams_started = False
        self._client = None
        self._audio_format = None

    async def start(self) -> None:
        """Launch the WebSocket sender loop and translation loop. Wait for audio to start streams."""
        self._client = self._client_factory(
            api_key=settings.mistral_api_key,
            server_url=settings.mistral_base_url,
        )
        self._audio_format = AudioFormat(
            encoding="pcm_s16le",
            sample_rate=self._sample_rate,
        )

        # Send initial status messages
        await self._send_status(StreamKind.FAST, StatusKind.CONNECTING)
        await self._send_status(StreamKind.SLOW, StatusKind.CONNECTING)

        self._sender_task = asyncio.create_task(self._sender_loop(), name="ws_sender")

        if self._target_language != "English":
            self._translation_task = asyncio.create_task(
                self._translation_loop(),
                name="translation_loop",
            )

    def _start_streams(self) -> None:
        if self._streams_started:
            return
        self._streams_started = True

        self._fast_task = asyncio.create_task(
            self._stream_runner(
                client=self._client,
                model=settings.mistral_model,
                delay_ms=self._fast_delay_ms,
                audio_iter=self._broadcaster.iter_stream(
                    self._broadcaster.fast_queue_index
                ),
                audio_format=self._audio_format,
                state=self._state,
                update_queue=self._update_queue,
                stream_kind=StreamKind.FAST,
            ),
            name="fast_stream",
        )

        self._slow_task = asyncio.create_task(
            self._stream_runner(
                client=self._client,
                model=settings.mistral_model,
                delay_ms=self._slow_delay_ms,
                audio_iter=self._broadcaster.iter_stream(
                    self._broadcaster.slow_queue_index
                ),
                audio_format=self._audio_format,
                state=self._state,
                update_queue=self._update_queue,
                stream_kind=StreamKind.SLOW,
            ),
            name="slow_stream",
        )

    async def feed_audio(self, chunk: bytes) -> None:
        """Called by the WebSocket handler for every binary frame."""
        gate_result = self._vad_gate.feed(chunk)

        if gate_result.forwarded_chunks and not self._streams_started:
            self._start_streams()

        for forwarded_chunk in gate_result.forwarded_chunks:
            await self._broadcaster.put(forwarded_chunk)

        if gate_result.speech_ended:
            self._signal_translation()

    async def close(self) -> None:
        """Gracefully cancel all tasks and drain the broadcaster."""
        gate_result = self._vad_gate.flush(force=True)
        
        if gate_result.forwarded_chunks and not self._streams_started:
            self._start_streams()

        for forwarded_chunk in gate_result.forwarded_chunks:
            await self._broadcaster.put(forwarded_chunk)

        await self._broadcaster.stop()

        # Wait for transcription streams to finish processing remaining audio
        if self._fast_task and not self._fast_task.done():
            await asyncio.gather(self._fast_task, return_exceptions=True)
        if self._slow_task and not self._slow_task.done():
            await asyncio.gather(self._slow_task, return_exceptions=True)

        # Cancel translation loop so it doesn't interfere with final send
        if self._translation_task and not self._translation_task.done():
            self._translation_task.cancel()
            await asyncio.gather(self._translation_task, return_exceptions=True)

        # Final translation if stopped manually
        if self._target_language != "English":
            source_text, _ = self._state.compute_display()
            source_text = clean_final_transcript(source_text)
            if source_text and source_text != self._last_translated_source:
                try:
                    self._is_translating = True
                    await self._push_transcript()

                    result = await self._translator(
                        transcription=source_text,
                        target_language=self._target_language,
                    )
                    if result.get("success"):
                        self._translated_text = result["translated_text"]
                        self._last_translated_source = source_text
                    else:
                        logger.error(
                            "Final translation failed: %s",
                            result.get("error"),
                        )
                except Exception as exc:
                    logger.error("Final translation error: %s", exc)
                finally:
                    self._is_translating = False
                    await self._push_transcript()

        if self._sender_task and not self._sender_task.done():
            self._sender_task.cancel()
            await asyncio.gather(self._sender_task, return_exceptions=True)

    async def _translation_loop(self) -> None:
        """Translate the current finalized text whenever VAD signals a pause."""
        while True:
            await self._translation_signal_queue.get()
            await asyncio.sleep(0.25)

            source_text, _ = self._state.compute_display()
            source_text = clean_final_transcript(source_text)

            if not source_text or source_text == self._last_translated_source:
                continue

            self._is_translating = True
            if self._update_queue.empty():
                try:
                    self._update_queue.put_nowait(None)
                except asyncio.QueueFull:
                    pass

            try:
                result = await self._translator(
                    transcription=source_text,
                    target_language=self._target_language,
                )
                if result.get("success"):
                    self._translated_text = result["translated_text"]
                    self._last_translated_source = source_text
            except Exception as exc:
                logger.error("Translation error: %s", exc)
            finally:
                self._is_translating = False
                if self._update_queue.empty():
                    try:
                        self._update_queue.put_nowait(None)
                    except asyncio.QueueFull:
                        pass

    async def _sender_loop(self) -> None:
        """
        Wait for update signals and push TranscriptMessage to the client.
        Runs until both streams are done or an error occurs.
        """
        while True:
            try:
                await asyncio.wait_for(self._update_queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                pass

            await self._push_transcript()

            if self._state.has_error:
                await self._send_error(self._state.error or "Unknown error")
                break

            if self._state.is_finished:
                break

    async def _push_transcript(self) -> None:
        confirmed, partial = self._state.compute_display()
        confirmed = clean_final_transcript(confirmed)
        msg = TranscriptMessage(
            confirmed_text=confirmed,
            partial_text=partial,
            fast_text=self._state.fast_full_text,
            slow_text=self._state.slow_full_text,
            translated_text=self._translated_text if self._target_language != "English" else None,
            is_translating=self._is_translating,
        )
        try:
            await self._ws.send_text(msg.model_dump_json())
        except Exception:
            logger.debug("WebSocket send failed - client likely disconnected")

    async def _send_status(self, stream: StreamKind, status: StatusKind) -> None:
        msg = StatusMessage(stream=stream, status=status)
        try:
            await self._ws.send_text(msg.model_dump_json())
        except Exception:
            pass

    async def _send_error(self, message: str) -> None:
        msg = ErrorMessage(message=message)
        try:
            await self._ws.send_text(msg.model_dump_json())
        except Exception:
            pass

    def _signal_translation(self) -> None:
        if self._target_language == "English":
            return

        if self._translation_signal_queue.empty():
            try:
                self._translation_signal_queue.put_nowait(None)
            except asyncio.QueueFull:
                pass
