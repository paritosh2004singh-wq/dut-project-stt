import asyncio
import json
import logging
 
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.models.messages import ConfigMessage, ResumeMessage
from app.services.session import TranscriptionSession
import uuid
 
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
        
        raw_msg = json.loads(raw_config)
        if raw_msg.get("type") == "resume_session":
            resume_msg = ResumeMessage(**raw_msg)
            config = ConfigMessage(
                session_id=resume_msg.session_id,
                target_language=resume_msg.target_language,
                translate_to_english=resume_msg.translate_to_english,
            )
            logger.info("Resuming session: %s", config.session_id)
        else:
            config = ConfigMessage(**raw_msg)
            logger.info(
                "Session config: sample_rate=%s fast=%sms slow=%sms",
                config.sample_rate,
                config.fast_delay_ms,
                config.slow_delay_ms,
            )
 
        if config.sample_rate not in (8000, 16000, 32000, 48000):
            raise ValueError(f"Unsupported sample rate: {config.sample_rate}")
        if config.chunk_duration_ms not in (10, 20, 30):
            raise ValueError(f"Unsupported chunk duration: {config.chunk_duration_ms} ms")

        # ── Step 2: create and start the session ──────────────────────────────
        session = TranscriptionSession(
            websocket,
            session_id=config.session_id,
            fast_delay_ms=config.fast_delay_ms,
            slow_delay_ms=config.slow_delay_ms,
            sample_rate=config.sample_rate,
            chunk_duration_ms=config.chunk_duration_ms,
            target_language=config.target_language,
            translate_to_english=config.translate_to_english,
            vad_threshold=config.vad_threshold if config.vad_threshold is not None else settings.vad_threshold,
            vad_min_speech_ms=config.vad_min_speech_ms if config.vad_min_speech_ms is not None else settings.vad_min_speech_ms,
            vad_min_silence_ms=config.vad_min_silence_ms if config.vad_min_silence_ms is not None else settings.vad_min_silence_ms,
            vad_speech_pad_ms=config.vad_speech_pad_ms if config.vad_speech_pad_ms is not None else settings.vad_speech_pad_ms,
            vad_aggressiveness=getattr(config, 'vad_aggressiveness', None) if getattr(config, 'vad_aggressiveness', None) is not None else settings.vad_aggressiveness,
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
                text = message["text"].strip()
                if text.lower() in ("stop", "auto_stop"):
                    logger.info("Client sent %s signal", text.lower())
                    break
                else:
                    try:
                        parsed = json.loads(text)
                        if parsed.get("type") == "ping":
                            await websocket.send_text('{"type": "pong"}')
                    except Exception:
                        pass
 
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
