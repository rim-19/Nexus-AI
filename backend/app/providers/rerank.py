"""Re-ranking providers. Default: Jina reranker v2 (validated live)."""
from __future__ import annotations
import httpx
from ..config import settings
from .base import RerankProvider, ProviderError, http

JINA_RERANK_URL = "https://api.jina.ai/v1/rerank"
COHERE_RERANK_URL = "https://api.cohere.com/v2/rerank"


class JinaReranker(RerankProvider):
    async def rerank(self, query, documents, top_n) -> list[tuple[int, float]]:
        if not settings.JINA_API_KEY:
            raise ProviderError("JINA_API_KEY missing")
        payload = {"model": settings.JINA_RERANK_MODEL, "query": query,
                   "documents": documents, "top_n": top_n}
        try:
            r = await http.post(JINA_RERANK_URL, json=payload,
                                headers={"Authorization": f"Bearer {settings.JINA_API_KEY}"})
            r.raise_for_status()
            return [(x["index"], x["relevance_score"]) for x in r.json()["results"]]
        except httpx.HTTPStatusError as e:
            raise ProviderError(f"jina rerank: {e.response.status_code} {e.response.text[:150]}")
        except Exception as e:  # noqa: BLE001
            raise ProviderError(f"jina rerank: {e!r}")


class CohereReranker(RerankProvider):
    async def rerank(self, query, documents, top_n) -> list[tuple[int, float]]:
        if not settings.COHERE_API_KEY:
            raise ProviderError("COHERE_API_KEY missing")
        payload = {"model": settings.COHERE_RERANK_MODEL, "query": query,
                   "documents": documents, "top_n": top_n}
        r = await http.post(COHERE_RERANK_URL, json=payload,
                            headers={"Authorization": f"Bearer {settings.COHERE_API_KEY}"})
        r.raise_for_status()
        return [(x["index"], x["relevance_score"]) for x in r.json()["results"]]


def build_reranker() -> RerankProvider:
    if settings.RERANK_PROVIDER == "cohere":
        return CohereReranker()
    return JinaReranker()
