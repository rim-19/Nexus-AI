"""Password hashing (argon2) + JWT access/refresh tokens (refresh carries a jti)."""
from __future__ import annotations
import uuid
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from jose import jwt, JWTError

from ..config import settings

_ph = PasswordHasher()


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def _encode(payload: dict, ttl: timedelta, kind: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {**payload, "type": kind, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


def create_access_token(user_id: str) -> str:
    return _encode({"sub": user_id}, timedelta(minutes=settings.JWT_ACCESS_TTL_MIN), "access")


def create_refresh_token(user_id: str) -> tuple[str, str, datetime]:
    """Returns (token, jti, expires_at). The jti is stored server-side for rotation."""
    jti = uuid.uuid4().hex
    exp = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TTL_DAYS)
    token = _encode({"sub": user_id, "jti": jti}, timedelta(days=settings.JWT_REFRESH_TTL_DAYS), "refresh")
    return token, jti, exp


def decode_token(token: str, expected_kind: str) -> dict | None:
    """Return the JWT payload if valid and of the expected kind, else None."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])
    except JWTError:
        return None
    if payload.get("type") != expected_kind:
        return None
    return payload
