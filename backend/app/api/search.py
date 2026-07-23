"""Global search across the user's collections + documents (powers Ctrl+K spotlight)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..db.models import User, WorkspaceMember, Collection, Document
from .deps import get_current_user

router = APIRouter(prefix="/api/v1", tags=["search"])


@router.get("/search")
async def search(q: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = (q or "").strip()
    if not q:
        return {"collections": [], "documents": []}
    like = f"%{q}%"
    ws_ids = select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user.id)
    col_ids = select(Collection.id).where(Collection.workspace_id.in_(ws_ids))

    cols = (await db.scalars(
        select(Collection).where(Collection.workspace_id.in_(ws_ids), Collection.name.ilike(like))
        .limit(8))).all()
    docs = (await db.scalars(
        select(Document).where(Document.collection_id.in_(col_ids), Document.source_ref.ilike(like))
        .limit(8))).all()

    return {
        "collections": [{"id": str(c.id), "name": c.name} for c in cols],
        "documents": [
            {"id": str(d.id), "source_ref": d.source_ref, "collection_id": str(d.collection_id),
             "source_type": d.source_type, "status": d.status}
            for d in docs
        ],
    }
