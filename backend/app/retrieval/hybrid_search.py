"""Hybrid retrieval: dense (pgvector cosine) + keyword (Postgres full-text),
merged with Reciprocal Rank Fusion. Scope-filtered.

scope = {"type": "workspace"|"collection"|"document", "id": "<uuid>"}
"""
from __future__ import annotations
import uuid

from sqlalchemy import select, func, literal_column
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Chunk, Collection
from ..providers import embedder
from ..config import settings

RRF_K = 60


def _scope_conditions(scope: dict):
    stype, sid = scope.get("type"), scope.get("id")
    sid = uuid.UUID(str(sid))
    if stype == "document":
        return [Chunk.document_id == sid]
    if stype == "collection":
        return [Chunk.collection_id == sid]
    if stype == "workspace":
        sub = select(Collection.id).where(Collection.workspace_id == sid)
        return [Chunk.collection_id.in_(sub)]
    raise ValueError(f"bad scope type: {stype}")


async def _vector_ids(db: AsyncSession, qvec: list[float], conds, k: int) -> list[uuid.UUID]:
    dist = Chunk.embedding.cosine_distance(qvec)
    rows = await db.execute(select(Chunk.id).where(*conds).order_by(dist).limit(k))
    return [r[0] for r in rows]


async def _keyword_ids(db: AsyncSession, query: str, conds, k: int) -> list[uuid.UUID]:
    tsq = func.plainto_tsquery("english", query)
    tsv = literal_column("tsv")
    rank = func.ts_rank(tsv, tsq)
    rows = await db.execute(
        select(Chunk.id).where(tsv.op("@@")(tsq), *conds).order_by(rank.desc()).limit(k))
    return [r[0] for r in rows]


def _rrf(*ranked_lists: list[uuid.UUID]) -> list[uuid.UUID]:
    scores: dict[uuid.UUID, float] = {}
    for lst in ranked_lists:
        for rank, cid in enumerate(lst):
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (RRF_K + rank + 1)
    return sorted(scores, key=scores.get, reverse=True)


async def hybrid_search(db: AsyncSession, query: str, scope: dict,
                        limit: int | None = None) -> list[Chunk]:
    limit = limit or settings.TOP_K_RETRIEVE
    conds = _scope_conditions(scope)
    qvec = (await embedder.embed([query]))[0]

    vec_ids = await _vector_ids(db, qvec, conds, limit)
    kw_ids = await _keyword_ids(db, query, conds, limit)
    fused = _rrf(vec_ids, kw_ids)[:limit]
    if not fused:
        return []

    # fetch full chunks, preserve fused order
    rows = await db.scalars(select(Chunk).where(Chunk.id.in_(fused)))
    by_id = {c.id: c for c in rows}
    return [by_id[cid] for cid in fused if cid in by_id]
