"""Async SQLAlchemy engine + session dependency."""
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from ..config import settings

# Supabase pooler in SESSION mode (port 5432) supports prepared statements, so
# asyncpg works without extra flags. (Transaction mode / 6543 would need
# statement_cache_size=0.)
#
# NOTE: the pgvector SQLAlchemy `Vector` type serializes list->'[..]' itself, so we
# do NOT also register the asyncpg vector codec (that double-converts and fails).
engine = create_async_engine(settings.async_db_url, pool_pre_ping=True, pool_size=5, max_overflow=5)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
