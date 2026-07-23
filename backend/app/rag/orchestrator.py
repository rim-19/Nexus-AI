"""RAG orchestration: hybrid retrieve -> rerank -> grounded prompt -> answer.

`prepare()` returns the final reranked chunks (used for citations) + the built
prompt. `answer()` is a non-streaming convenience (tests); the chat endpoint
streams tokens itself.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..providers import llm, reranker
from ..providers.base import ProviderError
from ..retrieval.hybrid_search import hybrid_search
from ..retrieval.prompt_builder import SYSTEM, build_user_prompt, build_citations


async def _rerank(question: str, candidates: list, top_n: int) -> list:
    if not candidates:
        return []
    try:
        ranked = await reranker.rerank(question, [c.content for c in candidates], top_n)
        return [candidates[i] for i, _ in ranked if i < len(candidates)]
    except ProviderError:
        # reranker down -> fall back to hybrid-search order
        return candidates[:top_n]


async def prepare(db: AsyncSession, question: str, scope: dict, history: str = "") -> tuple[list, str]:
    candidates = await hybrid_search(db, question, scope, settings.TOP_K_RETRIEVE)
    chunks = await _rerank(question, candidates, settings.TOP_K_RERANK)
    user_prompt = build_user_prompt(question, chunks, history)
    return chunks, user_prompt


async def answer(db: AsyncSession, question: str, scope: dict, history: str = "") -> dict:
    chunks, user_prompt = await prepare(db, question, scope, history)
    if not chunks:
        return {"answer": "I don't have enough information in the indexed sources to answer that.",
                "citations": [], "used_context": False}
    text = await llm.generate(SYSTEM, user_prompt, max_tokens=800)
    return {"answer": text, "citations": build_citations(chunks), "used_context": True}
