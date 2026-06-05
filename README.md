# Real-Time Speech-to-Text and Asynchronous Translation System

## Overview

This repository contains a real-time speech-to-text application with:

- WebSocket-based audio streaming from the browser to the backend
- Dual-delay transcription using Mistral realtime streaming
- Silence gating and hallucination suppression using a VAD pipeline
- Asynchronous translation using Groq
- Semantic search of past session archives
- A sleek, Apple-like unified dashboard frontend built with React

The backend listens for PCM audio, filters it through voice activity detection, streams voiced audio to transcription, and triggers translation when a pause is detected or recording stops. Transcripts are stored and can be retrieved via semantic search.

## Current Directory Layout

### Backend

- `backend/app/app.py` - FastAPI application setup, CORS, router registration
- `backend/app/routers/transcription.py` - WebSocket entrypoint at `/ws/transcribe`
- `backend/app/routers/health.py` - Health check endpoint at `/api/health`
- `backend/app/services/session.py` - Orchestrates transcription, VAD, sender loop, and translation
- `backend/app/services/voice_activity.py` - Silero VAD loader plus streaming gate
- `backend/app/services/transcript_cleanup.py` - Conservative cleanup for finalized transcripts
- `backend/app/services/transcription_runner.py` - Mistral realtime transcription loop
- `backend/app/services/translation.py` - Groq-backed translation helper
- `backend/app/services/audio_broadcaster.py` - Fan-out for fast and slow audio streams
- `backend/app/services/transcript_state.py` - Merges fast and slow transcripts into display state
- `backend/app/models/messages.py` - WebSocket message schemas
- `backend/app/core/config.py` - Environment-backed settings and defaults
- `backend/tests/` - Unit and session-level tests for cleanup and VAD behavior

### Frontend

- `frontend/src/App.jsx` - Page composition root (Unified Dashboard layout)
- `frontend/src/components/SearchInput.jsx` - Main transcript, recording, and typing search UI
- `frontend/src/components/SemanticSearchPanel.jsx` - Sidebar search input for querying session archive
- `frontend/src/components/RecentSessionsPanel.jsx` - Sidebar history of recent sessions
- `frontend/src/components/SearchResultList.jsx` - Sidebar display for semantic matches
- `frontend/src/components/SessionDetailPanel.jsx` - Main area display for inspecting a complete past session
- `frontend/src/components/SearchOptions.jsx` - Language selector and status strip
- `frontend/src/components/SearchResults.jsx` - Final transcript / translation results
- `frontend/src/components/RecordingControls.jsx` - Start/stop recording controls
- `frontend/src/components/AudioLevelIndicator.jsx` - Audio level meter
- `frontend/src/components/StatusIndicator.jsx` - Connection and stream status display
- `frontend/src/hooks/useAudioRecording.js` - Browser audio capture and WebSocket session hook
- `frontend/src/hooks/useSemanticSearch.js` - Hook for managing semantic search and session retrieval state
- `frontend/src/hooks/useAudioLevel.js` - Audio level tracking hook
- `frontend/src/utils/formatting.js` - Shared formatting helpers

## Architecture

### Audio and transcription flow

1. The frontend captures microphone audio in the browser.
2. Audio is converted to 16-bit PCM and sent to `ws://localhost:8000/ws/transcribe`.
3. The backend receives an initial config message with sample rate, delay values, target language, and optional VAD tuning values.
4. The backend VAD gate filters silence and forwards voiced chunks to the transcription streams.
5. Mistral provides:
   - a fast stream for partial transcript feedback
   - a slow stream for confirmed transcript text
6. When the VAD gate detects a pause, the confirmed transcript is cleaned and sent to Groq for translation.
7. The backend pushes transcript, status, and translation updates back to the browser over the same WebSocket.

### Unified Dashboard Interface

The React frontend features a clean, Apple-like dashboard:

- **Left Sidebar:** Hosts the semantic search panel and recent session history.
- **Main Area:** Centrally displays the active voice recording and live translation. It intelligently switches to a detailed view of past sessions when selected from the archive.
- **Search capabilities:** Users can search past transcriptions and translations semantically either via the sidebar or by directly typing into the main recording area.

### VAD and hallucination suppression

The backend now includes a Silero VAD pipeline with a conservative fallback path.

- Preferred path: Silero VAD loaded through `torch.hub.load`
- Fallback path: lightweight energy-based gating when PyTorch is unavailable

The gate is configured with:

- `vad_threshold`
- `vad_min_speech_ms`
- `vad_min_silence_ms`
- `vad_speech_pad_ms`

Final transcript cleanup is intentionally conservative:

- obvious fillers such as `um`, `uh`, `erm`, `ah`, `er`, `hmm`, `mm` are removed
- simple duplicate words are collapsed
- meaningful speech is preserved

## Technology Stack

### Backend

- FastAPI
- WebSockets
- Mistral realtime transcription
- Groq translation
- Optional Silero VAD via PyTorch
- Pydantic models and Pydantic Settings

### Frontend

- React 19
- Vite
- React Select
- React Icons
- Tailwind CSS v4

## Configuration

Environment variables are loaded from `backend/.env`.

Required backend values:

```env
GROQ_API_KEY=your_groq_api_key_value
MISTRAL_API_KEY=your_mistral_api_key_value
```

Optional backend tuning values are defined in `backend/app/core/config.py` and can be overridden from the initial WebSocket config message:

```json
{
  "type": "config",
  "sample_rate": 16000,
  "fast_delay_ms": 240,
  "slow_delay_ms": 2400,
  "chunk_duration_ms": 10,
  "target_language": "English",
  "vad_threshold": 0.5,
  "vad_min_speech_ms": 250,
  "vad_min_silence_ms": 100,
  "vad_speech_pad_ms": 30
}
```

## Installation

### Backend

1. Go to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the API:
   ```bash
   uvicorn app.app:app --reload
   ```

Note: VAD support adds `torch` and `torchaudio`, so backend installation is heavier than the base transcription stack.

### Frontend

1. Go to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   bun install
   # or
   npm install
   ```
3. Start the dev server:
   ```bash
   bun run dev
   # or
   npm run dev
   ```

The app is typically available at `http://localhost:5173`.

## Validation

Recommended checks:

- Backend tests:
  ```bash
  backend\\.venv\\Scripts\\python.exe -m unittest discover -s backend/tests -t backend
  ```
- Backend syntax check:
  ```bash
  python -m compileall backend/app backend/tests
  ```
- Frontend build:
  ```bash
  npm run build
  ```
- Frontend lint:
  ```bash
  npm run lint
  ```

## API Endpoints

- `GET /api/health` - basic service health check
- `WS /ws/transcribe` - realtime transcription and translation stream

## Notes

- The backend keeps the websocket message schema stable for the frontend.
- The translation flow remains asynchronous and only runs when confirmed speech has been finalized or a pause is detected.
- The frontend is now organized into small components and hooks, which makes the main `App.jsx` a lightweight composition root.
