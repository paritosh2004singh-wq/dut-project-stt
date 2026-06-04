import os
import logging
import sqlalchemy
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/stt_db")

try:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
except Exception as e:
    logger.error(f"Failed to initialize database engine: {e}")
    engine = None
    async_session = None

Base = declarative_base()

async def get_db():
    if not async_session:
        raise RuntimeError("Database engine is not initialized.")
    async with async_session() as session:
        yield session

async def init_db():
    if not engine:
        return
    # This imports the models to ensure they are registered with Base
    import app.db.models  # noqa
    try:
        async with engine.begin() as conn:
            # We must create the vector extension if it doesn't exist
            await conn.execute(sqlalchemy.text('CREATE EXTENSION IF NOT EXISTS vector'))
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logger.error(f"Error during database initialization: {e}")
