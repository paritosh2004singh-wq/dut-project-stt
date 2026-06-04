import asyncio
import json
import logging
 
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.models.messages import ConfigMessage
from app.services.session import TranscriptionSession
 
logger = logging.getLogger(__name__)
 
router = APIRouter(prefix="/ws", tags=["transcription"])
 
 
@router.websocket("/transcribe")
async def transcribe_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    logger.info("WebSocket connected: %s", websocket.client)
 
    session: TranscriptionSession | None = None
 
    try:
        # ── Step 1: receive config ────────────────────────────────────────────
        config_message = await asyncio.wait_for(websocket.receive(), timeout=10.0)
        logger.info("Received config_message: %s", config_message)
        
        # Extract the text payload from the WebSocket message
        raw_config = None
        if config_message.get("type") == "websocket.receive":
            raw_config = config_message.get("text")
        
        logger.info("Extracted raw_config: %s", raw_config)
        
        if raw_config is None:
            raise ValueError("Expected initial text config message")
        
        config = ConfigMessage(**json.loads(raw_config))
        logger.info(
            "Session config: sample_rate=%s fast=%sms slow=%sms",
            config.sample_rate,
            config.fast_delay_ms,
            config.slow_delay_ms,
        )
 
        # ── Step 2: create and start the session ──────────────────────────────
        session = TranscriptionSession(
            websocket,
            session_id=config.session_id,
            fast_delay_ms=config.fast_delay_ms,
            slow_delay_ms=config.slow_delay_ms,
            sample_rate=config.sample_rate,
            target_language=config.target_language,
            vad_threshold=config.vad_threshold if config.vad_threshold is not None else settings.vad_threshold,
            vad_min_speech_ms=config.vad_min_speech_ms if config.vad_min_speech_ms is not None else settings.vad_min_speech_ms,
            vad_min_silence_ms=config.vad_min_silence_ms if config.vad_min_silence_ms is not None else settings.vad_min_silence_ms,
            vad_speech_pad_ms=config.vad_speech_pad_ms if config.vad_speech_pad_ms is not None else settings.vad_speech_pad_ms,
        )
        await session.start()
 
        # ── Step 3: stream audio from client ──────────────────────────────────
        while True:
            message = await websocket.receive()
 
            # Binary frame → PCM audio chunk
            if "bytes" in message and message["bytes"] is not None:
                await session.feed_audio(message["bytes"])
 
            # Text frame → control signal
            elif "text" in message and message["text"] is not None:
                text = message["text"].strip().lower()
                if text == "stop":
                    logger.info("Client sent stop signal")
                    break
 
    except asyncio.TimeoutError:
        logger.warning("Timed out waiting for config message")
        await websocket.send_text('{"type":"error","message":"Config timeout"}')
 
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
 
    except RuntimeError as exc:
        if "disconnect" in str(exc).lower() or "close" in str(exc).lower():
            logger.info("WebSocket disconnected abruptly")
        else:
            logger.exception("Unexpected error in transcription handler")
            try:
                await websocket.send_text(f'{{"type":"error","message":"{exc}"}}')
            except Exception:
                pass

    except Exception as exc:
        logger.exception("Unexpected error in transcription handler")
        try:
            await websocket.send_text(f'{{"type":"error","message":"{exc}"}}')
        except Exception:
            pass
 
    finally:
        if session:
            await session.close()
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info("WebSocket session cleaned up")
