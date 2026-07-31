"""Knowledge graph for a collection: collection → documents → files (from chunk metadata)."""
from __future__ import annotations
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..db.models import User, Document, Chunk
from .deps import get_current_user, require_collection_access

router = APIRouter(prefix="/api/v1", tags=["graph"])

FILES_PER_REPO = 15


@router.get("/collections/{collection_id}/graph")
async def collection_graph(collection_id: uuid.UUID,
                           user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    col = await require_collection_access(collection_id, user, db)
    nodes: list[dict] = [{"id": "col", "label": col.name, "type": "collection"}]
    links: list[dict] = []

    docs = list(await db.scalars(select(Document).where(Document.collection_id == collection_id)))
    fp = Chunk.meta["file_path"].astext
    for d in docs:
        did = f"doc:{d.id}"
        nodes.append({"id": did, "label": d.source_ref.split("/")[-1], "type": "document",
                      "status": d.status, "kind": d.source_type})
        links.append({"source": "col", "target": did})
        if d.status == "ready" and d.source_type == "github":
            rows = await db.execute(
                select(fp.label("f"), func.count().label("n")).where(Chunk.document_id == d.id)
                .group_by(fp).order_by(func.count().desc()).limit(FILES_PER_REPO))
            for r in rows:
                if not r.f:
                    continue
                fid = f"file:{d.id}:{r.f}"
                nodes.append({"id": fid, "label": r.f.split("/")[-1], "type": "file",
                              "chunks": r.n, "path": r.f})
                links.append({"source": did, "target": fid})

    return {"nodes": nodes, "links": links}
