# Real-Time Speech-to-Text Architecture

This repository contains a highly scalable, real-time speech-to-text and translation application powered by Mistral, Groq, and Redis Streams.

It provides real-time transcription and immediate translation through a decoupled, microservices-based architecture.

## Features

- **Decoupled Microservices:** Audio ingestion, transcription, and translation are entirely separated into horizontally scalable Redis Stream workers.
- **Dual-Delay Transcription:** Utilizes Mistral realtime streaming. A fast stream (~240ms) provides immediate partial feedback, while a slow stream (~2400ms) delivers high-accuracy confirmed text.
- **Hallucination Suppression:** A WebRTC VAD gate filters out silence, preventing the STT models from hallucinating ambient noise or outputting endless "umm" and "ahh" fillers.
- **Apple-like Unified Dashboard:** A sleek React UI utilizing Tailwind CSS v4 to manage live recordings and real-time translations.

## Directory Layout

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed Mermaid diagrams of the system topology.

### Backend

- `backend/app/main.py` - FastAPI application entry point.
- `backend/app/routers/` - REST Endpoints and WebSockets (`/ws/transcribe`, `/api/health`).
- `backend/worker_stt.py` - Consumes audio chunks, generates Mistral transcripts.
- `backend/worker_llm.py` - Consumes completed transcripts, translates via Groq.
- `docker-compose.yml` - Orchestration of Redis and workers.

**Deployment Note:** The backend API has been aggressively optimized and uses a lightweight WebRTC VAD. It is now suitable for deployment on low-memory instances like an `e2-micro` VM.

### Frontend

- `frontend/src/App.jsx` - Page composition root (Unified Dashboard layout).
- `frontend/src/components/` - UI components for recording and transcripts.
- `frontend/src/hooks/` - Web Audio API capture and WebSocket state managers.

## Quickstart Installation

### Prerequisites
- Docker & Docker Compose
- Node.js / Bun (for the frontend)
- Python 3.13 (for local backend)

**Deployment on Low-Resource VMs (e2-micro, 1GB RAM, 10GB disk)?**

👉 **See [E2_MICRO_DEPLOY.md](./E2_MICRO_DEPLOY.md)** for the single-threaded build method.

**Quick command for e2-micro:**
```bash
docker system prune -f
cd ~/project-stt
BUILDKIT_MAX_PARALLEL_BUILDS=1 docker compose up --build -d
```

### 1. Environment Setup

Inside the `backend/` directory, create a `.env` file:

```env
GROQ_API_KEY=your_groq_api_key_value
MISTRAL_API_KEY=your_mistral_api_key_value
```

### 2. Launching Redis and Background Workers

**For normal environments (2GB+ RAM, 20GB+ disk):**
```bash
docker-compose up -d --build
```

**For low-resource VMs (e2-micro: 1GB RAM, 10GB disk):**
```bash
# Clean first
docker system prune -f

# Build with single-threaded mode (prevents parallel builds)
BUILDKIT_MAX_PARALLEL_BUILDS=1 docker compose up --build -d
```

This starts:
- `redis` on port `6379`
- `stt-worker` and `llm-worker` scaling in the background.



### 3. Launching the Backend API (Locally)

```bash
cd backend
# Activate virtual environment and install requirements
.venv\Scripts\activate
pip install -r requirements.txt

# Start FastAPI server
python main.py
```

*The API will run on `http://localhost:8080`.*

### 4. Launching the Frontend (Locally)

```bash
cd frontend
npm install
npm run dev
```

The unified dashboard will be available at `http://localhost:5173`.

## 🧪 Testing

The backend includes a comprehensive, mocked testing suite ensuring worker isolation and silence gating behave as expected.

```bash
cd backend
python -m unittest discover -s tests -t .
```

## 🔌 API Endpoints

- `GET /api/health` - Basic service health check.
- `WS /ws/transcribe` - Real-time transcription and translation ingestion stream.
