from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

# ──────────────────────────────────────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────────────────────────────────────

class StreamKind(str, Enum):
    FAST = "fast"
    SLOW = "slow"

class StatusKind(str, Enum):
    CONNECTING = "connecting"
    LISTENING  = "listening"
    DONE       = "done"
    STOPPED    = "stopped"
    ERROR      = "error"

# ──────────────────────────────────────────────────────────────────────────────
# Client → Server
# ──────────────────────────────────────────────────────────────────────────────

class ConfigMessage(BaseModel):
    """Client sends this JSON message to configure the session."""
    type: Literal["config"] = "config"
    session_id: str | None = None
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    fast_delay_ms: int = Field(default=240, ge=0)
    slow_delay_ms: int = Field(default=2400, ge=0)
    chunk_duration_ms: int = Field(default=10, ge=1)
    target_language: str = "English"
    translate_to_english: bool = False
    vad_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    vad_min_speech_ms: int | None = Field(default=None, ge=0)
    vad_min_silence_ms: int | None = Field(default=None, ge=0)
    vad_speech_pad_ms: int | None = Field(default=None, ge=0)
    vad_aggressiveness: int | None = Field(default=None, ge=0, le=3)

class ResumeMessage(BaseModel):
    """Client sends this JSON message to resume an existing session."""
    type: Literal["resume_session"] = "resume_session"
    session_id: str
    target_language: str = "English"
    translate_to_english: bool = False


