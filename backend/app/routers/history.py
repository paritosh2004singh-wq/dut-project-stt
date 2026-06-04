import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db import crud
from app.services.embeddings import generate_embedding
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/api", tags=["history"])

class SessionSummaryResponse(BaseModel):
    id: uuid.UUID
    created_at: datetime
    source_language: Optional[str]
    target_language: str
    status: str

class TranscriptSegmentResponse(BaseModel):
    id: uuid.UUID
    text: str
    translation: Optional[str]
    created_at: datetime

class SessionDetailResponse(SessionSummaryResponse):
    segments: List[TranscriptSegmentResponse]

class SearchResultResponse(BaseModel):
    session_id: uuid.UUID
    segment_id: uuid.UUID
    text: str
    translation: Optional[str]

@router.get("/sessions", response_model=List[SessionSummaryResponse])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    sessions = await crud.get_all_sessions(db)
    return sessions

@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
async def get_session_detail(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    session = await crud.get_session(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.get("/search", response_model=List[SearchResultResponse])
async def search_transcripts(q: str, db: AsyncSession = Depends(get_db)):
    embedding = await generate_embedding(q)
    if not embedding:
        raise HTTPException(status_code=500, detail="Failed to generate embedding for query")
    
    results = await crud.search_segments(db, embedding, limit=10)
    
    # results is a list of tuples: (TranscriptSegmentDB, SessionDB)
    search_results = []
    for segment, session in results:
        search_results.append(SearchResultResponse(
            session_id=session.id,
            segment_id=segment.id,
            text=segment.text,
            translation=segment.translation
        ))
    return search_results
