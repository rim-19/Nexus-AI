"""Workspace + collection routes (tenant-scoped)."""
from __future__ import annotations
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..db.models import User, Workspace, WorkspaceMember, Collection
from ..schemas import WorkspaceOut, WorkspaceCreate, CollectionOut, CollectionCreate
from .deps import get_current_user, require_workspace_access

router = APIRouter(prefix="/api/v1", tags=["workspaces"])


@router.get("/workspaces", response_model=list[WorkspaceOut])
async def list_workspaces(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(
        select(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == user.id)
        .order_by(Workspace.created_at)
    )
    return list(rows)


@router.post("/workspaces", response_model=WorkspaceOut, status_code=201)
async def create_workspace(body: WorkspaceCreate, user: User = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    ws = Workspace(name=body.name, owner_user_id=user.id, type="individual")
    db.add(ws)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="owner"))
    await db.commit()
    await db.refresh(ws)
    return ws


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceOut)
async def get_workspace(workspace_id: uuid.UUID, user: User = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    return await require_workspace_access(workspace_id, user, db)


@router.get("/workspaces/{workspace_id}/collections", response_model=list[CollectionOut])
async def list_collections(workspace_id: uuid.UUID, user: User = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    await require_workspace_access(workspace_id, user, db)
    rows = await db.scalars(
        select(Collection).where(Collection.workspace_id == workspace_id).order_by(Collection.created_at)
    )
    return list(rows)


@router.post("/workspaces/{workspace_id}/collections", response_model=CollectionOut, status_code=201)
async def create_collection(workspace_id: uuid.UUID, body: CollectionCreate,
                            user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_workspace_access(workspace_id, user, db)
    col = Collection(workspace_id=workspace_id, name=body.name)
    db.add(col)
    await db.commit()
    await db.refresh(col)
    return col


@router.get("/collections/{collection_id}", response_model=CollectionOut)
async def get_collection(collection_id: uuid.UUID, user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    from .deps import require_collection_access
    return await require_collection_access(collection_id, user, db)
