import os
import json
import base64
from typing import Dict, Any
import redis.asyncio as redis_async
import redis.exceptions

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis_async.from_url(
    REDIS_URL,
    decode_responses=True,
    socket_timeout=None,
    socket_connect_timeout=None
)

async def init_redis_groups():
    """Initialize stream consumer groups if they don't exist."""
    for stream, group in [("audio_stream", "stt_workers"), ("translate_stream", "llm_workers")]:
        try:
            await redis_client.xgroup_create(stream, group, id="0", mkstream=True)
        except redis.exceptions.ResponseError as e:
            if "BUSYGROUP" not in str(e):
                print(f"Error creating {stream} group: {e}")

async def publish_audio_chunk(
    session_id: str,
    chunk: bytes,
    sequence: int,
    target_language: str,
    translate_to_english: bool = False,
):
    encoded_chunk = base64.b64encode(chunk).decode("utf-8")
    await redis_client.xadd("audio_stream", {
        "session_id": session_id,
        "chunk": encoded_chunk,
        "sequence": str(sequence),
        "target_language": target_language,
        "translate_to_english": str(translate_to_english).lower(),
    }, maxlen=10000, approximate=True)

async def publish_translate_job(session_id: str, text: str, target_language: str):
    await redis_client.xadd("translate_stream", {
        "session_id": session_id,
        "text": text,
        "target_language": target_language
    }, maxlen=10000, approximate=True)

async def push_to_dlq(stream_name: str, payload: Dict[str, str], error_msg: str):
    payload["error"] = error_msg
    await redis_client.xadd(f"{stream_name}_dlq", payload, maxlen=10000, approximate=True)


async def publish_session_event(session_id: str, payload: Dict[str, Any]):
    await redis_client.publish(f"results:{session_id}", json.dumps(payload))
