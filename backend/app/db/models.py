import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.db.database import Base

class SessionDB(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    source_language = Column(String, nullable=True)
    target_language = Column(String, nullable=False, default="English")
    status = Column(String, nullable=False, default="in_progress")
    
    segments = relationship("TranscriptSegmentDB", back_populates="session", cascade="all, delete-orphan", order_by="TranscriptSegmentDB.timestamp_start")

class TranscriptSegmentDB(Base):
    __tablename__ = "transcript_segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    timestamp_start = Column(Float, nullable=True)
    timestamp_end = Column(Float, nullable=True)
    
    text = Column(Text, nullable=False)
    translation = Column(Text, nullable=True)
    
    # Mistral embeddings are 1024 dimensions
    embedding = Column(Vector(1024), nullable=True)

    session = relationship("SessionDB", back_populates="segments")
