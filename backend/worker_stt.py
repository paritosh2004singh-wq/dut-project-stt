import asyncio
import logging
import base64
import uuid
from mistralai.client import Mistral
from mistralai.client.models import AudioFormat
from app.core.config import settings
from app.core.redis import redis_client, init_redis_groups, publish_session_event, publish_translate_job
from app.services.transcript_state import TranscriptState
from app.services.transcription_runner import run_stream
from app.services.transcript_cleanup import clean_final_transcript
from app.models.messages import StreamKind


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

active_sessions = {}


def _parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in ("1", "true", "yes", "on")

class STTSessionOrchestrator:
    def __init__(self, session_id: str, target_language: str, translate_to_english: bool = False):
        self.session_id = session_id
        self.target_language = target_language
        self.translate_to_english = translate_to_english
        self.state = TranscriptState()
        self.fast_queue = asyncio.Queue()
        self.slow_queue = asyncio.Queue()
        self.update_queue = asyncio.Queue(maxsize=1)
        
        self.client = Mistral(api_key=settings.mistral_api_key, server_url=settings.mistral_base_url)
        self.audio_format = AudioFormat(encoding="pcm_s16le", sample_rate=16000)
        
        self.fast_task = None
        self.slow_task = None
        self.sender_task = None
        self.sequence = 0
        
        self.last_saved_source = ""
        self.start_text_len = 0
        
    async def start(self):
        pass

        self.sender_task = asyncio.create_task(self.sender_loop())
        
        self.fast_task = asyncio.create_task(run_stream(
            client=self.client,
            model=settings.mistral_model,
            delay_ms=240,
            audio_iter=self.iter_queue(self.fast_queue),
            audio_format=self.audio_format,
            state=self.state,
            update_queue=self.update_queue,
            stream_kind=StreamKind.FAST
        ))
        
        self.slow_task = asyncio.create_task(run_stream(
            client=self.client,
            model=settings.mistral_model,
            delay_ms=2400,
            audio_iter=self.iter_queue(self.slow_queue),
            audio_format=self.audio_format,
            state=self.state,
            update_queue=self.update_queue,
            stream_kind=StreamKind.SLOW
        ))
        
    async def iter_queue(self, q: asyncio.Queue):
        while True:
            chunk = await q.get()
            if chunk == b"EOF":
                break
            yield chunk

    async def sender_loop(self):
        try:
            while True:
                try:
                    await asyncio.wait_for(self.update_queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                
                self.sequence += 1
                confirmed, partial = self.state.compute_display()
                confirmed = clean_final_transcript(confirmed)
                
                # Compute active english text in current segment (since last speech_ended)
                active_english_text = confirmed[self.start_text_len:]
                
                # Send the standard transcript update
                msg = {
                    "type": "transcript",
                    "sequence": self.sequence,
                    "confirmed_text": confirmed,
                    "active_english_text": active_english_text,
                    "partial_text": partial,
                    "fast_text": self.state.fast_full_text,
                    "slow_text": self.state.slow_full_text,
                    "is_translating": False
                }
                
                await publish_session_event(self.session_id, msg)
                
                if self.state.has_error or self.state.is_finished:
                    break
        finally:
            pass

    async def feed(self, chunk: bytes):
        self.fast_queue.put_nowait(chunk)
        self.slow_queue.put_nowait(chunk)
        
    async def process_speech_ended(self):
        confirmed, _ = self.state.compute_display()
        confirmed = clean_final_transcript(confirmed)
        
        if not confirmed or confirmed == self.last_saved_source:
            return
            
        new_text = confirmed[self.start_text_len:].strip()
        if not new_text:
            return
            
        self.last_saved_source = confirmed
        self.start_text_len = len(confirmed)
        
        try:
            if self.translate_to_english or self.target_language != "English":
                await publish_translate_job(self.session_id, confirmed, self.target_language)
        except Exception as e:
            logger.error(f"Error on speech_ended: {e}")

async def process_audio_stream():
    await init_redis_groups()
    logger.info("STT Worker started, listening to audio_stream...")

    while True:
        try:
            messages = await redis_client.xreadgroup(
                "stt_workers", 
                "stt_consumer_1", 
                {"audio_stream": ">"}, 
                count=10, 
                block=0
            )
            for stream, msgs in messages:
                for msg_id, payload in msgs:
                    session_id = payload.get("session_id")
                    target_language = payload.get("target_language", "English")
                    translate_to_english = _parse_bool(payload.get("translate_to_english", False))
                    
                    if session_id in active_sessions:
                        existing_orch = active_sessions[session_id]
                        if existing_orch.state.has_error or (existing_orch.fast_task and existing_orch.fast_task.done()) or (existing_orch.slow_task and existing_orch.slow_task.done()):
                            logger.warning(f"Orchestrator for session {session_id} has errors or dead tasks. Cleaning up and recreating...")
                            try:
                                if existing_orch.fast_task: existing_orch.fast_task.cancel()
                                if existing_orch.slow_task: existing_orch.slow_task.cancel()
                                if existing_orch.sender_task: existing_orch.sender_task.cancel()
                            except Exception:
                                pass
                            del active_sessions[session_id]

                    # Only create orchestrator when we have actual audio chunk
                    if "chunk" in payload:
                        if session_id not in active_sessions:
                            orch = STTSessionOrchestrator(session_id, target_language, translate_to_english)
                            await orch.start()
                            active_sessions[session_id] = orch
                        
                        orch = active_sessions[session_id]
                        chunk = base64.b64decode(payload["chunk"])
                        await orch.feed(chunk)
                    elif session_id in active_sessions:
                        orch = active_sessions[session_id]
                    else:
                        # Event for non-existent session, skip
                        await redis_client.xack(stream, "stt_workers", msg_id)
                        continue
                    
                    # Handle events
                    if payload.get("event") == "speech_ended" and session_id in active_sessions:
                        orch = active_sessions[session_id]
                        await orch.process_speech_ended()
                        
                    if payload.get("event") == "disconnect" and session_id in active_sessions:
                        orch = active_sessions[session_id]
                        await orch.feed(b"EOF")
                        await orch.process_speech_ended()
                        del active_sessions[session_id]
                        
                    await redis_client.xack(stream, "stt_workers", msg_id)

        except Exception as e:
            logger.error(f"STT Worker error: {e}")
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(process_audio_stream())
