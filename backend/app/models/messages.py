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
    vad_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    vad_min_speech_ms: int | None = Field(default=None, ge=0)
    vad_min_silence_ms: int | None = Field(default=None, ge=0)
    vad_speech_pad_ms: int | None = Field(default=None, ge=0)

class ResumeMessage(BaseModel):
    """Client sends this JSON message to resume an existing session."""
    type: Literal["resume_session"] = "resume_session"
    session_id: str
    target_language: str = "English"

# ──────────────────────────────────────────────────────────────────────────────
# Server → Client
# ──────────────────────────────────────────────────────────────────────────────

class StatusMessage(BaseModel):
    type: Literal["status"] = "status"
    stream: StreamKind
    status: StatusKind

class TranscriptMessage(BaseModel):
    """
    Carries the full merged state of both streams.
    """
    type: Literal["transcript"] = "transcript"
    sequence: int = 0
    confirmed_text: str = ""
    partial_text: str = ""
    fast_text: str = ""
    slow_text: str = ""
    translated_text: str | None = None
    is_translating: bool = False

class SessionRestoredMessage(BaseModel):
    type: Literal["session_restored"] = "session_restored"
    history: str
    translated_history: str | None = None

class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    message: str

class TranslationStartedMessage(BaseModel):
    type: Literal["translation_started"] = "translation_started"

class TranslationCompleteMessage(BaseModel):
    type: Literal["translation_complete"] = "translation_complete"
    translated_text: str | None = None
