import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import SessionDB, TranscriptSegmentDB

async def create_session(db: AsyncSession, session_id: uuid.UUID, target_language: str) -> SessionDB:
    new_session = SessionDB(id=session_id, target_language=target_language)
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session

async def get_session(db: AsyncSession, session_id: uuid.UUID) -> Optional[SessionDB]:
    result = await db.execute(
        select(SessionDB)
        .options(selectinload(SessionDB.segments))
        .where(SessionDB.id == session_id)
    )
    return result.scalar_one_or_none()

async def get_all_sessions(db: AsyncSession, limit: int = 50) -> List[SessionDB]:
    result = await db.execute(
        select(SessionDB)
        .order_by(SessionDB.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())

async def update_session_status(db: AsyncSession, session_id: uuid.UUID, status: str, source_language: Optional[str] = None):
    session = await get_session(db, session_id)
    if session:
        session.status = status
        if source_language:
            session.source_language = source_language
        await db.commit()

async def create_segment(
    db: AsyncSession, 
    session_id: uuid.UUID, 
    text: str, 
    translation: Optional[str] = None, 
    embedding: Optional[List[float]] = None
) -> TranscriptSegmentDB:
    segment = TranscriptSegmentDB(
        session_id=session_id,
        text=text,
        translation=translation,
        embedding=embedding
    )
    db.add(segment)
    await db.commit()
    await db.refresh(segment)
    return segment

async def search_segments(db: AsyncSession, query_embedding: List[float], limit: int = 10):
    # Using L2 distance (`<->`). For cosine distance, use `<=>`.
    # Mistral embeddings are normalized so L2 distance is monotonically related to cosine distance, 
    # but let's use cosine distance.
    result = await db.execute(
        select(TranscriptSegmentDB, SessionDB)
        .join(SessionDB, TranscriptSegmentDB.session_id == SessionDB.id)
        .order_by(TranscriptSegmentDB.embedding.cosine_distance(query_embedding))
        .limit(limit)
    )
    return result.all()
