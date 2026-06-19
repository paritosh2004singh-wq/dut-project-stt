import asyncio
import logging
from app.core.redis import redis_client, init_redis_groups, push_to_dlq, publish_session_event
from app.services.translation import translate_transcription_advanced

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def process_translate_stream():
    await init_redis_groups()
    logger.info("LLM Worker started, listening to translate_stream...")

    while True:
        try:
            messages = await redis_client.xreadgroup(
                "llm_workers", 
                "llm_consumer_1", 
                {"translate_stream": ">"}, 
                count=1, 
                block=0
            )
            for stream, msgs in messages:
                for msg_id, payload in msgs:
                    session_id = payload.get("session_id")
                    text = payload.get("text")
                    target_language = (payload.get("target_language") or "English").strip() or "English"

                    try:
                        await publish_session_event(session_id, {"type": "translation_started"})

                        result = await translate_transcription_advanced(transcription=text, target_language=target_language)
                        
                        if result.get("success"):
                            translated_text = result["translated_text"]
                            
                            await publish_session_event(session_id, {
                                "type": "translation_complete",
                                "translated_text": translated_text
                            })
                            

                        else:
                            await push_to_dlq("translate", payload, result.get("error", "Unknown error"))
                            
                    except Exception as e:
                        logger.error(f"Error processing translate job: {e}")
                        await push_to_dlq("translate", payload, str(e))
                    finally:
                        await redis_client.xack(stream, "llm_workers", msg_id)

        except Exception as e:
            logger.error(f"Worker error: {e}")
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(process_translate_stream())
