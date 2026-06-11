# System Architecture

This document describes the decoupled, microservices-based architecture of the Dual-Delay STT application.

## 1. High-Level Topology

The system uses **Redis Streams** to decouple the fast ingestion of audio from the heavy processing of transcription and translation. This allows each worker type to scale independently.

```mermaid
graph TD
    Client[React Frontend] <-->|WebSocket PCM| WS_API(FastAPI Server)

    subgraph Redis Message Broker
        R_Audio[(audio_stream)]
        R_Translate[(translate_stream)]
        R_PubSub((Pub/Sub: session_id))
    end

    WS_API -->|VAD-filtered audio| R_Audio
    
    R_Audio -->|Consume Group| STT[STT Workers Mistral]
    STT -->|Final Transcript| R_Translate
    STT -.->|Publish Transcript| R_PubSub

    R_Translate -->|Consume Group| LLM[LLM Workers Groq]
    LLM -.->|Publish Translation| R_PubSub

    R_PubSub -.->|Broadcast| WS_API
```

## 2. Worker Roles

### FastAPI WebSocket Server
- Exposes `ws://localhost:8080/ws/transcribe`.
- Maintains the active WebSocket connection with the client.
- Runs a local Voice Activity Detection (VAD) gate to drop silence and only forward actual speech.
- Publishes voiced PCM chunks to the Redis `audio_stream`.
- Subscribes to the Redis Pub/Sub channel for the specific `session_id` and forwards results (transcripts, translations) back to the client.

### STT Worker (`worker_stt.py`)
- Consumes from `audio_stream`.
- Maintains a dual-delay Mistral STT connection (fast partials + slow confirmed).
- Runs hallucination suppression to filter out filler words (um, ah) and hallucinations.
- When speech finishes (via a silence event), it finalizes the text and publishes downstream to `translate_stream`.

### LLM Worker (`worker_llm.py`)
- Consumes from `translate_stream`.
- Translates the confirmed transcript via the Groq API.
- Publishes translation status and the final translated text to the Redis Pub/Sub channel.
