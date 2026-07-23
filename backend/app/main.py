"""KnowledgeHub AI — FastAPI entrypoint.

Step 0: health + AI self-test. DB routers are wired in Step 1 once the
Supabase DATABASE_URL is set.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

import asyncio
from contextlib import asynccontextmanager

from .config import settings
from .providers import llm, embedder, reranker
from .providers.base import ProviderError, http
from .jobs import run_worker
from .ratelimit import limiter
from .api import auth as auth_routes
from .api import workspaces as workspace_routes
from .api import documents as document_routes
from .api import chat as chat_routes
from .api import eval as eval_routes
from .api import search as search_routes
from .api import stats as stats_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # durable ingestion worker (drains ingestion_jobs, retries, survives restarts)
    stop = asyncio.Event()
    worker = asyncio.create_task(run_worker(stop))
    yield
    stop.set()
    worker.cancel()
    try:
        await worker
    except asyncio.CancelledError:
        pass
    # clean shutdown: close AI HTTP client + DB engine (avoids Windows SSL teardown noise)
    await http.aclose()
    from .db.session import engine
    await engine.dispose()


app = FastAPI(title="Nexus AI", version="0.2.0", lifespan=lifespan)

# rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS locked to the frontend origin (required for credentialed cookie requests)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_routes.router)
app.include_router(workspace_routes.router)
app.include_router(document_routes.router)
app.include_router(chat_routes.router)
app.include_router(eval_routes.router)
app.include_router(search_routes.router)
app.include_router(stats_routes.router)


@app.get("/health")
async def health():
    return {"status": "ok", "db_configured": bool(settings.DATABASE_URL)}


@app.get("/api/v1/ai/ping")
async def ai_ping():
    """Exercises the live provider chain end-to-end (generation, embeddings, rerank)."""
    result: dict = {"llm_provider": settings.LLM_PROVIDER, "embed_provider": settings.EMBED_PROVIDER}

    try:
        result["llm"] = await llm.generate("You are terse.", "Reply with exactly: OK", max_tokens=5)
    except ProviderError as e:
        result["llm"] = f"FAILED: {e}"

    try:
        vecs = await embedder.embed(["hello world"])
        result["embed_dim"] = len(vecs[0])
    except ProviderError as e:
        result["embed"] = f"FAILED: {e}"

    try:
        ranked = await reranker.rerank(
            "how does authentication work",
            ["auth uses JWT tokens and Redis sessions", "the cat sat on the mat"],
            top_n=2,
        )
        result["rerank_top_index"] = ranked[0][0]
    except ProviderError as e:
        result["rerank"] = f"FAILED: {e}"

    return result
