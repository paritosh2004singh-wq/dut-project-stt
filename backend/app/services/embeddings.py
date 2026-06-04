import os
import logging
from mistralai.client import Mistral

logger = logging.getLogger(__name__)

MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY")
client = Mistral(api_key=MISTRAL_API_KEY) if MISTRAL_API_KEY else None

async def generate_embedding(text: str) -> list[float]:
    if not client:
        logger.warning("Mistral API key not configured, skipping embedding generation")
        return None
    try:
        response = await client.embeddings.create_async(
            model="mistral-embed",
            inputs=[text]
        )
        if response.data:
            return response.data[0].embedding
        return None
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        return None
