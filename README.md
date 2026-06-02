# Real-Time Speech-to-Text and Asynchronous Translation System

## 1. Executive Summary

This repository contains the source code for an enterprise-grade, real-time Speech-to-Text (STT) transcription and automated translation system. The application employs a full-duplex, bidirectional communication pipeline over WebSockets to deliver high-performance, low-latency audio processing. The system features a sophisticated dual-delay stream architecture designed to yield immediate partial transcriptions while maintaining a high-fidelity semantic translation pipeline. Translations are powered by advanced Large Language Model (LLM) interfaces, utilizing asynchronous integrations with Groq and Mistral API providers.

---

## 2. System Architecture and Design Methodologies

The application is split into a decoupled, service-oriented backend and a responsive, state-driven frontend web client.

### 2.1 Dual-Delay Audio Processing Pipeline
To balance the competing demands of low-latency user feedback and high-accuracy sentence structure compilation, the system operates on a dual-delay transcription architecture:
* **The Fast Stream (240ms Window)**: Captures high-frequency partial audio chunks, producing near-instantaneous transcription segments to reflect user utterances in real time.
* **The Slow Stream (2400ms Window)**: Pools audio segments over an extended window to isolate complete semantic units (sentences and clauses) and compile confirmed final transcriptions.

### 2.2 Inactivity-Triggered Asynchronous Translation
Machine translation is computationally intensive and requires coherent context. Rather than translating continuous fragments, the backend implements an activity monitor:
* **Detection Threshold**: A 2.0-second silence window is measured programmatically through the WebSocket session.
* **Trigger Mechanism**: Once the 2.0-second threshold is crossed (or the user manually terminates the recording session), the accumulated, confirmed transcript is queued for translation.
* **Visual State Feedback**: During active speech, the frontend registers a suspended state ("Waiting for pause to translate..."). Upon inactivity detection, it transitions to a processing state ("Translating...") until the final payload is received.

---

## 3. Technology Stack

### 3.1 Backend Service Layer
* **Web Framework**: FastAPI (Python Asyncio)
* **API Protocol**: WebSocket (RFC 6455) for persistent binary audio ingestion and JSON message serialization
* **Translation Interface**: `AsyncGroq` and Mistral REST Client wrappers, facilitating non-blocking, multi-threaded language processing
* **Asynchronous Design**: Full integration of `asyncio` routines to prevent event-loop blocking during network-bound LLM execution

### 3.2 Frontend Presentation Layer
* **Application Framework**: React (Vite-backed build environment)
* **Package Management**: Bun / npm
* **Styling Paradigm**: Vanilla CSS implementing standard layouts, absolute variable mapping, and high-performance micro-animations
* **Linting and Validation**: ESLint for codebase static analysis

---

## 4. Key Component Definitions

### 4.1 Backend Components (`backend/app/`)
* **`routers/transcription.py`**: Hosts the WebSocket endpoint (`/ws/transcribe`), handling handshakes, message reception loops, connection lifecycle states, and clean disconnects.
* **`services/session.py`**: Coordinates the lifespan of a transcription session, including binary stream accumulation, chunk delegation, and final translation handoffs.
* **`services/translation.py`**: Interacts with Groq and Mistral external gateways to process raw transcriptions into target languages based on user-supplied parameters (formality, target locale).
* **`models/messages.py`**: Contains Pydantic schematics defining structure and types for transcripts, server-to-client telemetry, and metadata packets.

### 4.2 Frontend Components (`frontend/src/`)
* **`App.jsx`**: The core component that encapsulates web-audio API capture, client-side WebSocket state management, UI rendering, dimming logic for historical speech, and visual processing alerts.

---

## 5. Deployment and Installation

### 5.1 Environment Requirements
* Python 3.10 or higher
* Node.js v18 or higher (or Bun runtime)
* Access keys to Groq and/or Mistral developer portals
* Backend VAD support also requires `torch` and `torchaudio`, which makes the Python install noticeably heavier than the base transcription stack

### 5.2 Backend Deployment Steps
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Initialize and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   # For Windows Command Prompt:
   # .venv\Scripts\activate
   ```
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` configuration file in the backend root directory and declare your credentials:
   ```env
   GROQ_API_KEY=your_groq_api_key_value
   MISTRAL_API_KEY=your_mistral_api_key_value
   ```
5. Launch the application server utilizing the Uvicorn ASGI server:
   ```bash
   uvicorn app.app:app --reload
   ```

### 5.3 Frontend Deployment Steps
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the necessary Node packages:
   ```bash
   bun install
   # Or alternatively:
   # npm install
   ```
3. Compile and launch the local web server:
   ```bash
   bun run dev
   # Or alternatively:
   # npm run dev
   ```
4. Access the web client via the address output by the build tool (typically `http://localhost:5173`).
