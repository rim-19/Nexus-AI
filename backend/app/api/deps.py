"""Shared dependencies: current user + tenant access checks."""
from __future__ import annotations
import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db.session import get_db
from ..db.models import User, Workspace, WorkspaceMember, Collection
from ..core.security import decode_token


def _extract_token(request: Request) -> str | None:
    """Prefer the httpOnly cookie; fall back to Authorization: Bearer for API clients."""
    tok = request.cookies.get(settings.ACCESS_COOKIE)
    if tok:
        return tok
    auth = request.headers.get("Authorization", "")
    return auth[7:] if auth.startswith("Bearer ") else None


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_token(token, "access")
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = await db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


async def require_workspace_access(
    workspace_id: uuid.UUID, user: User, db: AsyncSession
) -> Workspace:
    """Owner or member may access. Raises 403/404 otherwise."""
    ws = await db.get(Workspace, workspace_id)
    if not ws:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace not found")
    if ws.owner_user_id == user.id:
        return ws
    member = await db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        )
    )
    if not member:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this workspace")
    return ws


async def require_collection_access(
    collection_id: uuid.UUID, user: User, db: AsyncSession
) -> Collection:
    col = await db.get(Collection, collection_id)
    if not col:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Collection not found")
    await require_workspace_access(col.workspace_id, user, db)
    return col
