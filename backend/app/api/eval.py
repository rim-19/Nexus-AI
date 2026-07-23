"""Evaluation routes: create eval sets, list, run (returns scored report)."""
from __future__ import annotations
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..db.models import User, EvalSet, EvalItem
from ..schemas import EvalSetCreate, EvalSetOut
from ..eval.runner import run_eval_set
from .deps import get_current_user, require_collection_access

router = APIRouter(prefix="/api/v1", tags=["eval"])


@router.post("/collections/{collection_id}/eval-sets", response_model=EvalSetOut, status_code=201)
async def create_eval_set(collection_id: uuid.UUID, body: EvalSetCreate,
                          user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_collection_access(collection_id, user, db)
    es = EvalSet(collection_id=collection_id, name=body.name)
    db.add(es)
    await db.flush()
    for it in body.items:
        db.add(EvalItem(eval_set_id=es.id, question=it.question,
                        expected_answer=it.expected_answer, gold_source=it.gold_source))
    await db.commit()
    await db.refresh(es)
    return es


@router.get("/collections/{collection_id}/eval-sets", response_model=list[EvalSetOut])
async def list_eval_sets(collection_id: uuid.UUID, user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    await require_collection_access(collection_id, user, db)
    rows = await db.scalars(
        select(EvalSet).where(EvalSet.collection_id == collection_id).order_by(EvalSet.created_at))
    return list(rows)


@router.post("/eval-sets/{eval_set_id}/run")
async def run_eval(eval_set_id: uuid.UUID, user: User = Depends(get_current_user),
                   db: AsyncSession = Depends(get_db)):
    es = await db.get(EvalSet, eval_set_id)
    if not es:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Eval set not found")
    await require_collection_access(es.collection_id, user, db)
    return await run_eval_set(db, eval_set_id)
