"""Aggregate stats for the Mission Control dashboard widgets."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..db.models import User, WorkspaceMember, Collection, Document, Chunk, Conversation, Message
from .deps import get_current_user

router = APIRouter(prefix="/api/v1", tags=["stats"])


@router.get("/stats")
async def stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ws_ids = select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user.id)
    col_ids = select(Collection.id).where(Collection.workspace_id.in_(ws_ids))

    collections = await db.scalar(
        select(func.count()).select_from(Collection).where(Collection.workspace_id.in_(ws_ids)))
    documents = await db.scalar(
        select(func.count()).select_from(Document).where(Document.collection_id.in_(col_ids)))
    chunks = await db.scalar(
        select(func.coalesce(func.sum(Document.num_chunks), 0)).where(Document.collection_id.in_(col_ids)))
    tokens = await db.scalar(
        select(func.coalesce(func.sum(Chunk.token_count), 0)).where(Chunk.collection_id.in_(col_ids)))
    questions = await db.scalar(
        select(func.count()).select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Conversation.user_id == user.id, Message.role == "user"))

    return {
        "collections": collections or 0,
        "documents": documents or 0,
        "chunks": int(chunks or 0),
        "tokens_indexed": int(tokens or 0),
        "questions_asked": questions or 0,
    }
