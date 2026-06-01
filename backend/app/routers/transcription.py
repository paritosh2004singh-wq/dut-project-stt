import asyncio
import json
import logging
 
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
 
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
        raw_config = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
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
            fast_delay_ms=config.fast_delay_ms,
            slow_delay_ms=config.slow_delay_ms,
            sample_rate=config.sample_rate,
            target_language=config.target_language,
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
