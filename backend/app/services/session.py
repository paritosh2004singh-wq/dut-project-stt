import asyncio
import logging
import time
 
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
from app.services.transcript_state import TranscriptState
from app.services.transcription_runner import run_stream
from app.services.translation import translate_transcription_advanced
 
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
    ) -> None:
        self._ws = websocket
        self._fast_delay_ms = fast_delay_ms
        self._slow_delay_ms = slow_delay_ms
        self._sample_rate = sample_rate
        self._target_language = target_language
 
        self._broadcaster = AudioBroadcaster(n_streams=2)
        self._state = TranscriptState()
 
        # update_queue: a signal (None) tells the sender loop to push state
        self._update_queue: asyncio.Queue[None] = asyncio.Queue(maxsize=1)
 
        self._fast_task: asyncio.Task | None = None
        self._slow_task: asyncio.Task | None = None
        self._sender_task: asyncio.Task | None = None
        self._translation_task: asyncio.Task | None = None
        
        self._translated_text = ""
        self._last_translated_source = ""
        self._is_translating = False
 
    # ── Public interface ──────────────────────────────────────────────────────
 
    async def start(self) -> None:
        """Launch both transcription tasks and the WebSocket sender loop."""
        client = Mistral(
            api_key=settings.mistral_api_key,
            server_url=settings.mistral_base_url,
        )
        audio_format = AudioFormat(
            encoding="pcm_s16le",
            sample_rate=self._sample_rate,
        )
 
        # Send initial status messages
        await self._send_status(StreamKind.FAST, StatusKind.CONNECTING)
        await self._send_status(StreamKind.SLOW, StatusKind.CONNECTING)
 
        self._fast_task = asyncio.create_task(
            run_stream(
                client=client,
                model=settings.mistral_model,
                delay_ms=self._fast_delay_ms,
                audio_iter=self._broadcaster.iter_stream(
                    self._broadcaster.fast_queue_index
                ),
                audio_format=audio_format,
                state=self._state,
                update_queue=self._update_queue,
                stream_kind=StreamKind.FAST,
            ),
            name="fast_stream",
        )
 
        self._slow_task = asyncio.create_task(
            run_stream(
                client=client,
                model=settings.mistral_model,
                delay_ms=self._slow_delay_ms,
                audio_iter=self._broadcaster.iter_stream(
                    self._broadcaster.slow_queue_index
                ),
                audio_format=audio_format,
                state=self._state,
                update_queue=self._update_queue,
                stream_kind=StreamKind.SLOW,
            ),
            name="slow_stream",
        )
 
        self._sender_task = asyncio.create_task(
            self._sender_loop(), name="ws_sender"
        )
        
        if self._target_language != "English":
            self._translation_task = asyncio.create_task(
                self._translation_loop(), name="translation_loop"
            )
 
    async def feed_audio(self, chunk: bytes) -> None:
        """Called by the WebSocket handler for every binary frame."""
        await self._broadcaster.put(chunk)
 
    async def close(self) -> None:
        """Gracefully cancel all tasks and drain the broadcaster."""
        await self._broadcaster.stop()
        
        # Wait for transcription streams to finish processing remaining audio
        if self._fast_task and not self._fast_task.done():
            await asyncio.gather(self._fast_task, return_exceptions=True)
        if self._slow_task and not self._slow_task.done():
            await asyncio.gather(self._slow_task, return_exceptions=True)
            
        # Cancel translation loop so it doesn't interfere
        if self._translation_task and not self._translation_task.done():
            self._translation_task.cancel()
            await asyncio.gather(self._translation_task, return_exceptions=True)
        
        # Final translation if stopped manually
        if self._target_language != "English":
            source_text, _ = self._state.compute_display()
            if source_text and source_text != self._last_translated_source:
                try:
                    self._is_translating = True
                    await self._push_transcript()
                    
                    result = await translate_transcription_advanced(
                        transcription=source_text,
                        target_language=self._target_language
                    )
                    if result.get("success"):
                        self._translated_text = result["translated_text"]
                        self._last_translated_source = source_text
                    else:
                        logger.error(f"Final translation failed: {result.get('error')}")
                except Exception as e:
                    logger.error("Final translation error: %s", e)
                finally:
                    self._is_translating = False
                    await self._push_transcript()
 
        if self._sender_task and not self._sender_task.done():
            self._sender_task.cancel()
            await asyncio.gather(self._sender_task, return_exceptions=True)
 
    # ── Internal helpers ──────────────────────────────────────────────────────
    
    async def _translation_loop(self) -> None:
        """Background task to periodically translate the confirmed text."""
        last_seen_source = ""
        last_seen_time = time.time()
        
        while True:
            await asyncio.sleep(0.5)
            
            source_text, _ = self._state.compute_display()
            
            # If text has changed, reset the inactivity timer
            if source_text != last_seen_source:
                last_seen_source = source_text
                last_seen_time = time.time()
                
            is_untranslated = (source_text and source_text != self._last_translated_source)
            is_inactive = (time.time() - last_seen_time >= 2.0)
            
            if is_untranslated and (is_inactive or self._state.is_finished):
                self._is_translating = True
                if self._update_queue.empty():
                    try:
                        self._update_queue.put_nowait(None)
                    except asyncio.QueueFull:
                        pass
                
                try:
                    result = await translate_transcription_advanced(
                        transcription=source_text,
                        target_language=self._target_language
                    )
                    if result.get("success"):
                        self._translated_text = result["translated_text"]
                        self._last_translated_source = source_text
                except Exception as e:
                    logger.error("Translation error: %s", e)
                finally:
                    self._is_translating = False
                    # Signal sender loop to push new transcript state
                    if self._update_queue.empty():
                        try:
                            self._update_queue.put_nowait(None)
                        except asyncio.QueueFull:
                            pass
                    
            if self._state.is_finished:
                break
 
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
 
            # Always send an update on any signal (or timeout)
            await self._push_transcript()
 
            # Check for error
            if self._state.has_error:
                await self._send_error(self._state.error or "Unknown error")
                break
 
            # Check for completion
            if self._state.is_finished:
                break
 
    async def _push_transcript(self) -> None:
        confirmed, partial = self._state.compute_display()
        msg = TranscriptMessage(
            confirmed_text=confirmed,
            partial_text=partial,
            fast_text=self._state.fast_full_text,
            slow_text=self._state.slow_full_text,
            translated_text=self._translated_text if self._target_language != "English" else None,
            is_translating=self._is_translating
        )
        try:
            await self._ws.send_text(msg.model_dump_json())
        except Exception:
            logger.debug("WebSocket send failed — client likely disconnected")
 
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
