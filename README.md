# Real-Time Speech-to-Text & RAG Architecture

This repository contains a highly scalable, real-time speech-to-text application powered by Mistral, Groq, Redis Streams, and PostgreSQL (`pgvector`). 

It provides real-time transcription, immediate translation, and an advanced Retrieval-Augmented Generation (RAG) search engine to query past meeting archives.

## 🌟 Features

- **Decoupled Microservices:** Audio ingestion, transcription, translation, and semantic embedding are entirely separated into horizontally scalable Redis Stream workers.
- **Dual-Delay Transcription:** Utilizes Mistral realtime streaming. A fast stream (~240ms) provides immediate partial feedback, while a slow stream (~2400ms) delivers high-accuracy confirmed text.
- **Hallucination Suppression:** A PyTorch Silero VAD gate filters out silence, preventing the STT models from hallucinating ambient noise or outputting endless "umm" and "ahh" fillers.
- **Advanced RAG Engine:** Ask questions about past sessions! Queries are vectorized, expanded into overlapping contextual paragraphs, strictly re-ranked using a local Cross-Encoder (`ms-marco-MiniLM`), and answered natively via LLaMA-3 (Groq).
- **Apple-like Unified Dashboard:** A sleek React UI utilizing Tailwind CSS v4 to manage live recordings, real-time translations, and archive searching.

## 🏗 Directory Layout

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed Mermaid diagrams of the system topology.

### Backend

- `backend/app/main.py` - FastAPI application entry point.
- `backend/app/routers/` - REST Endpoints and WebSockets (`/ws/transcribe`, `/api/ask`).
- `backend/app/services/rag.py` - The advanced RAG pipeline orchestrator (Context Merging + Cross-Encoder).
- `backend/worker_stt.py` - Consumes audio chunks, generates Mistral transcripts.
- `backend/worker_llm.py` - Consumes completed transcripts, translates via Groq.
- `backend/worker_embedding.py` - Consumes completed text, vectors them into Postgres.
- `backend/worker_cron.py` - Manages database TTLs (deletes >24hr sessions).
- `backend/docker-compose.yml` - Complete orchestration of the DB, Redis, and workers.

### Frontend

- `frontend/src/App.jsx` - Page composition root (Unified Dashboard layout).
- `frontend/src/components/` - Granular UI components for search, recording, and transcripts.
- `frontend/src/hooks/` - Web Audio API capture and WebSocket state managers.

## 🚀 Quickstart Installation

The entire infrastructure has been Dockerized for immediate deployment.

### Prerequisites
- Docker & Docker Compose
- Node.js (for the frontend)

### 1. Environment Setup

Inside the `backend/` directory, create a `.env` file:

```env
GROQ_API_KEY=your_groq_api_key_value
MISTRAL_API_KEY=your_mistral_api_key_value
```

### 2. Launching the Backend Architecture

The backend consists of Postgres (pgvector), Redis, the FastAPI API, and four distinct background workers. You can spin them all up using Docker Compose:

```bash
cd backend
docker-compose up -d --build
```

This starts:
- `db` (Postgres 15 + pgvector) on port `5432`
- `redis` on port `6379`
- `api` (FastAPI) on port `8000`
- `stt-worker`, `llm-worker`, `embedding-worker`, and `cron-worker` scaling in the background.

*(If you are developing locally without Docker, you can run `uv pip install -r requirements.txt` and start the workers via `python worker_stt.py` etc).*

### 3. Launching the Frontend

```bash
cd frontend
npm install
npm run dev
```

The unified dashboard will be available at `http://localhost:5173`.

## 🧪 Testing

The backend includes a comprehensive, mocked testing suite ensuring worker isolation, silence gating, and database TTLs behave as expected.

```bash
cd backend
# Using uv or pip
uv run python -m unittest discover -s tests -t .
```

## 🔌 API Endpoints

- `GET /api/health` - Basic service health check.
- `GET /api/sessions` - List recent transcription sessions.
- `GET /api/sessions/{session_id}` - Retrieve a complete transcript history.
- `GET /api/ask?q=...` - The RAG Endpoint. Searches the transcripts, cross-encodes relevant paragraphs, and returns a grounded LLaMA-3 answer with source citations.
- `WS /ws/transcribe` - Real-time transcription and translation ingestion stream.
