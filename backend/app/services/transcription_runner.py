import asyncio
import logging
from typing import AsyncIterator
 
from mistralai.client import Mistral
from mistralai.client.models import (
    AudioFormat,
    RealtimeTranscriptionError,
    RealtimeTranscriptionSessionCreated,
    TranscriptionStreamDone,
    TranscriptionStreamTextDelta,
)
 
from app.models.messages import StreamKind
from app.services.transcript_state import TranscriptState
 
logger = logging.getLogger(__name__)
 
 
async def run_stream(
    *,
    client: Mistral,
    model: str,
    delay_ms: int,
    audio_iter: AsyncIterator[bytes],
    audio_format: AudioFormat,
    state: TranscriptState,
    update_queue: asyncio.Queue[None],
    stream_kind: StreamKind,
) -> None:
    """
    Run one transcription stream (fast or slow) to completion.
 
    
    """
    is_fast = stream_kind == StreamKind.FAST
 
    def _signal() -> None:
        """Put a signal in the update queue without blocking."""
        if update_queue.empty():
            try:
                update_queue.put_nowait(None)
            except asyncio.QueueFull:
                pass
 
    try:
        async for event in client.audio.realtime.transcribe_stream(
            audio_stream=audio_iter,
            model=model,
            audio_format=audio_format,
            target_streaming_delay_ms=delay_ms,
        ):
            if isinstance(event, RealtimeTranscriptionSessionCreated):
                _signal()
 
            elif isinstance(event, TranscriptionStreamTextDelta):
                if is_fast:
                    state.append_fast(event.text)
                else:
                    state.append_slow(event.text)
                _signal()
 
            elif isinstance(event, TranscriptionStreamDone):
                if is_fast:
                    state.mark_fast_done()
                else:
                    state.mark_slow_done()
                _signal()
                break
 
            elif isinstance(event, RealtimeTranscriptionError):
                logger.error("Transcription error (%s): %s", stream_kind, event.error)
                state.set_error(str(event.error))
                _signal()
                break
 
            else:
                # UnknownRealtimeEvent — ignore silently
                continue
 
    except asyncio.CancelledError:
        # Graceful shutdown — mark as stopped rather than error
        _signal()
        raise
 
    except Exception as exc:  # pragma: no cover
        logger.exception("Unexpected error in %s stream", stream_kind)
        state.set_error(str(exc))
        _signal()
 
