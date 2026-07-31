"""Lightweight in-memory rate limiter as a FastAPI dependency.

Applied via `dependencies=[Depends(rate_limit(n))]` so it never touches an
endpoint's own signature (which is what broke request-body parsing when using
slowapi's decorator). Fine for a single instance; use Redis to scale out.
"""
from __future__ import annotations
import time
from collections import defaultdict

from fastapi import Request, HTTPException, status

_hits: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(max_calls: int, window: int = 60):
    async def dep(request: Request):
        key = f"{_client_ip(request)}:{request.url.path}"
        now = time.time()
        hits = _hits[key]
        cutoff = now - window
        while hits and hits[0] < cutoff:
            hits.pop(0)
        if len(hits) >= max_calls:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests — slow down.")
        hits.append(now)
    return dep
