"""Chat: hybrid-retrieve -> rerank -> stream a grounded, cited answer (SSE).

Response is text/event-stream with JSON events:
  {"type":"meta","conversation_id":...}
  {"type":"token","text":"..."}         (repeated)
  {"type":"done","citations":[...]}
"""
from __future__ import annotations
import uuid
import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..db.models import User, Conversation, Message
from ..schemas import ChatIn, MessageOut
from ..rag.orchestrator import prepare
from ..retrieval.prompt_builder import SYSTEM, build_citations
from ..providers import llm
from ..providers.base import ProviderError
from .deps import get_current_user, require_collection_access

router = APIRouter(prefix="/api/v1", tags=["chat"])
HISTORY_TURNS = 6
REFUSAL = "I don't have enough information in the indexed sources to answer that."


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


async def _history(db: AsyncSession, conv_id: uuid.UUID) -> str:
    rows = list(await db.scalars(
        select(Message).where(Message.conversation_id == conv_id)
        .order_by(Message.created_at.desc()).limit(HISTORY_TURNS)))
    rows.reverse()
    return "\n".join(f"{'You' if m.role == 'user' else 'AI'}: {m.content}" for m in rows)


@router.post("/collections/{collection_id}/chat")
async def chat(collection_id: uuid.UUID, body: ChatIn,
               user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_collection_access(collection_id, user, db)
    scope = ({"type": body.scope.type, "id": str(body.scope.id)} if body.scope
             else {"type": "collection", "id": str(collection_id)})

    # conversation (create or verify ownership)
    if body.conversation_id:
        conv = await db.get(Conversation, body.conversation_id)
        if not conv or conv.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    else:
        conv = Conversation(collection_id=collection_id, user_id=user.id, scope=scope)
        db.add(conv)
        await db.flush()

    history = await _history(db, conv.id)
    db.add(Message(conversation_id=conv.id, role="user", content=body.question))
    await db.commit()

    # retrieve + rerank BEFORE streaming (so citations are known)
    chunks, user_prompt = await prepare(db, body.question, scope, history)
    citations = build_citations(chunks)
    conv_id = str(conv.id)

    async def gen():
        yield _sse({"type": "meta", "conversation_id": conv_id})
        full = []
        if not chunks:
            full.append(REFUSAL)
            yield _sse({"type": "token", "text": REFUSAL})
        else:
            try:
                async for tok in llm.stream(SYSTEM, user_prompt, max_tokens=800):
                    full.append(tok)
                    yield _sse({"type": "token", "text": tok})
            except ProviderError as e:
                yield _sse({"type": "error", "message": str(e)})
        # persist assistant message (session stays open through streaming)
        db.add(Message(conversation_id=uuid.UUID(conv_id), role="assistant",
                       content="".join(full), citations=citations))
        await db.commit()
        yield _sse({"type": "done", "citations": citations})

    return StreamingResponse(gen(), media_type="text/event-stream")


@router.get("/conversations/{conversation_id}", response_model=list[MessageOut])
async def get_conversation(conversation_id: uuid.UUID, user: User = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    conv = await db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    rows = await db.scalars(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at))
    return list(rows)
