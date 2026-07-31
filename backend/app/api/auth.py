"""Auth: cookie-based sessions with refresh-token rotation, email verification,
password reset, and rate limits. Tokens live in httpOnly cookies (not JS-readable)."""
from __future__ import annotations
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db.session import get_db
from ..db.models import User, Workspace, WorkspaceMember, RefreshToken, EmailToken
from ..core.security import (
    hash_password, verify_password, create_access_token, create_refresh_token, decode_token,
)
from ..schemas import (
    RegisterIn, LoginIn, UserOut, EmailVerifyIn, PasswordResetRequestIn, PasswordResetIn, OkOut,
)
from ..email_utils import send_link
from ..ratelimit import rate_limit
from .deps import get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


# ---------- cookie helpers ----------
def _set_cookie(resp: Response, name: str, value: str, max_age: int, path: str) -> None:
    resp.set_cookie(name, value, max_age=max_age, path=path, httponly=True,
                    secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE)


async def _issue_session(db: AsyncSession, user_id: uuid.UUID, resp: Response) -> None:
    access = create_access_token(str(user_id))
    refresh, jti, exp = create_refresh_token(str(user_id))
    db.add(RefreshToken(user_id=user_id, jti=jti, expires_at=exp))
    await db.commit()
    _set_cookie(resp, settings.ACCESS_COOKIE, access, settings.JWT_ACCESS_TTL_MIN * 60, "/")
    _set_cookie(resp, settings.REFRESH_COOKIE, refresh, settings.JWT_REFRESH_TTL_DAYS * 86400, "/api/v1/auth")


def _clear_session(resp: Response) -> None:
    resp.delete_cookie(settings.ACCESS_COOKIE, path="/")
    resp.delete_cookie(settings.REFRESH_COOKIE, path="/api/v1/auth")


async def _make_email_token(db: AsyncSession, user_id: uuid.UUID, kind: str, hours: int) -> str:
    token = secrets.token_urlsafe(32)
    db.add(EmailToken(user_id=user_id, kind=kind, token=token,
                      expires_at=datetime.now(timezone.utc) + timedelta(hours=hours)))
    await db.commit()
    return token


# ---------- register / login ----------
@router.post("/register", response_model=UserOut, status_code=201,
             dependencies=[Depends(rate_limit(5))])
async def register(body: RegisterIn, response: Response, db: AsyncSession = Depends(get_db)):
    if await db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    user = User(email=body.email, password_hash=hash_password(body.password), name=body.name)
    db.add(user)
    await db.flush()
    ws = Workspace(name=f"{body.name or body.email.split('@')[0]}'s Workspace",
                   owner_user_id=user.id, type="individual")
    db.add(ws)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="owner"))
    await db.commit()

    token = await _make_email_token(db, user.id, "verify", 48)
    send_link("verify", user.email, token)   # dev: logged
    await _issue_session(db, user.id, response)
    return user


@router.post("/login", response_model=UserOut, dependencies=[Depends(rate_limit(10))])
async def login(body: LoginIn, response: Response, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    await _issue_session(db, user.id, response)
    return user


# ---------- refresh (with rotation) ----------
@router.post("/refresh", response_model=OkOut)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get(settings.REFRESH_COOKIE)
    payload = decode_token(token, "refresh") if token else None
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    row = await db.scalar(select(RefreshToken).where(RefreshToken.jti == payload.get("jti")))
    now = datetime.now(timezone.utc)
    if not row or row.revoked or row.expires_at <= now:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token expired or revoked")

    row.revoked = True                       # rotate: single-use refresh tokens
    await db.commit()
    await _issue_session(db, uuid.UUID(payload["sub"]), response)
    return OkOut()


@router.post("/logout", response_model=OkOut)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get(settings.REFRESH_COOKIE)
    payload = decode_token(token, "refresh") if token else None
    if payload:
        await db.execute(update(RefreshToken).where(RefreshToken.jti == payload.get("jti"))
                         .values(revoked=True))
        await db.commit()
    _clear_session(response)
    return OkOut()


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


# ---------- email verification ----------
@router.post("/verify-email", response_model=OkOut)
async def verify_email(body: EmailVerifyIn, db: AsyncSession = Depends(get_db)):
    tok = await db.scalar(select(EmailToken).where(EmailToken.token == body.token, EmailToken.kind == "verify"))
    if not tok or tok.used or tok.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired token")
    tok.used = True
    user = await db.get(User, tok.user_id)
    if user:
        user.email_verified = True
    await db.commit()
    return OkOut()


# ---------- password reset ----------
@router.post("/request-password-reset", response_model=OkOut,
             dependencies=[Depends(rate_limit(5))])
async def request_password_reset(body: PasswordResetRequestIn, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email))
    if user:                                  # silent if not found (no account enumeration)
        token = await _make_email_token(db, user.id, "reset", 2)
        send_link("reset", user.email, token)
    return OkOut()


@router.post("/reset-password", response_model=OkOut, dependencies=[Depends(rate_limit(5))])
async def reset_password(body: PasswordResetIn, db: AsyncSession = Depends(get_db)):
    tok = await db.scalar(select(EmailToken).where(EmailToken.token == body.token, EmailToken.kind == "reset"))
    if not tok or tok.used or tok.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired token")
    tok.used = True
    user = await db.get(User, tok.user_id)
    if user:
        user.password_hash = hash_password(body.password)
        # revoke all sessions on password change
        await db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id).values(revoked=True))
    await db.commit()
    return OkOut()
