"""Rich analytics: totals, latency, time-series, most-cited files, recent jobs."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..db.models import User, WorkspaceMember, Collection, Document, Chunk, QueryLog, IngestionJob
from .deps import get_current_user

router = APIRouter(prefix="/api/v1", tags=["analytics"])


@router.get("/analytics")
async def analytics(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ws_ids = select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user.id)
    cols = select(Collection.id).where(Collection.workspace_id.in_(ws_ids))
    uid = str(user.id)

    collections = await db.scalar(select(func.count()).select_from(Collection).where(Collection.workspace_id.in_(ws_ids)))
    documents = await db.scalar(select(func.count()).select_from(Document).where(Document.collection_id.in_(cols)))
    repositories = await db.scalar(select(func.count()).select_from(Document).where(Document.collection_id.in_(cols), Document.source_type == "github"))
    chunks = await db.scalar(select(func.coalesce(func.sum(Document.num_chunks), 0)).where(Document.collection_id.in_(cols)))
    tokens = await db.scalar(select(func.coalesce(func.sum(Chunk.token_count), 0)).where(Chunk.collection_id.in_(cols)))
    questions = await db.scalar(select(func.count()).select_from(QueryLog).where(QueryLog.user_id == user.id))
    avg_latency = await db.scalar(select(func.avg(QueryLog.latency_ms)).where(QueryLog.user_id == user.id))

    qot = await db.execute(text(
        "select to_char(date_trunc('day', created_at),'MM-DD') d, count(*) c "
        "from query_logs where user_id = :uid and created_at > now() - interval '14 days' "
        "group by 1, date_trunc('day', created_at) order by date_trunc('day', created_at)"),
        {"uid": uid})
    questions_over_time = [{"date": r.d, "count": r.c} for r in qot]

    mcf = await db.execute(text(
        "select f as file, count(*) c from query_logs, jsonb_array_elements_text(cited_files) f "
        "where user_id = :uid group by f order by c desc limit 8"), {"uid": uid})
    most_cited_files = [{"file": r.file, "count": r.c} for r in mcf]

    top_repos = (await db.execute(
        select(Document.source_ref, Document.num_chunks)
        .where(Document.collection_id.in_(cols), Document.source_type == "github")
        .order_by(Document.num_chunks.desc()).limit(6))).all()

    recent_jobs = (await db.execute(
        select(Document.source_ref, IngestionJob.status, IngestionJob.created_at)
        .join(Document, IngestionJob.document_id == Document.id)
        .where(Document.collection_id.in_(cols))
        .order_by(IngestionJob.created_at.desc()).limit(6))).all()

    latest = (await db.execute(
        select(Document.source_ref, Document.source_type, Document.created_at)
        .where(Document.collection_id.in_(cols))
        .order_by(Document.created_at.desc()).limit(6))).all()

    return {
        "totals": {
            "collections": collections or 0, "documents": documents or 0,
            "repositories": repositories or 0, "chunks": int(chunks or 0),
            "questions": questions or 0, "tokens_indexed": int(tokens or 0),
            "embeddings": int(chunks or 0),
        },
        "avg_latency_ms": int(avg_latency) if avg_latency else 0,
        "questions_over_time": questions_over_time,
        "most_cited_files": most_cited_files,
        "top_repositories": [{"source_ref": r[0], "chunks": r[1]} for r in top_repos],
        "recent_jobs": [{"document": r[0], "status": r[1], "created_at": r[2].isoformat()} for r in recent_jobs],
        "latest_uploads": [{"source_ref": r[0], "source_type": r[1], "created_at": r[2].isoformat()} for r in latest],
    }
