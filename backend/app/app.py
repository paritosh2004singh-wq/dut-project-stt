import logging
 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
 
from app.core.config import settings
from app.routers import health_router, transcription_router
from app.routers.history import router as history_router
from app.db.database import init_db
 
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
 
app = FastAPI(
    title="Dual Delay Transcription API",
    description=(
        "Real-time audio transcription using the Mistral dual-delay method. "
        "A fast stream (~240 ms delay) provides immediate partial results; "
        "a slow stream (~2400 ms delay) provides high-accuracy confirmed text."
    ),
    version="1.0.0",
)
 
@app.on_event("startup")
async def startup_event():
    await init_db()
 
# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(transcription_router)
app.include_router(history_router)
 
 
@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {"message": "Dual Delay Transcription API is running"}

