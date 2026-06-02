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
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    fast_delay_ms: int = Field(default=240, ge=0)
    slow_delay_ms: int = Field(default=2400, ge=0)
    chunk_duration_ms: int = Field(default=10, ge=1)
    target_language: str = "English"
    vad_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    vad_min_speech_ms: int | None = Field(default=None, ge=0)
    vad_min_silence_ms: int | None = Field(default=None, ge=0)
    vad_speech_pad_ms: int | None = Field(default=None, ge=0)
 
 
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
 
    confirmed_text : text that the slow stream has confirmed (shown in white)
    partial_text   : words from the fast stream ahead of the slow cursor
                     (shown in yellow / italic on the frontend)
    fast_text      : raw fast-stream accumulator (for debugging / display)
    slow_text      : raw slow-stream accumulator (for debugging / display)
    """
    type: Literal["transcript"] = "transcript"
    confirmed_text: str = ""
    partial_text: str = ""
    fast_text: str = ""
    slow_text: str = ""
    translated_text: str | None = None
    is_translating: bool = False
 
 
class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    message: str
 
