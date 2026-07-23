"""Embedding providers. Default: Jina jina-embeddings-v3 (1024-dim, validated live).

NOTE: the vector column is fixed at EMBED_DIM. Switching provider/model to a
different dimension requires re-indexing all documents.
"""
from __future__ import annotations
import httpx
from ..config import settings
from .base import EmbeddingProvider, ProviderError, http

JINA_URL = "https://api.jina.ai/v1/embeddings"
GEMINI_EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"


class JinaEmbeddings(EmbeddingProvider):
    dim = 1024

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not settings.JINA_API_KEY:
            raise ProviderError("JINA_API_KEY missing")
        payload = {"model": settings.JINA_EMBED_MODEL, "input": texts}
        try:
            r = await http.post(JINA_URL, json=payload,
                                headers={"Authorization": f"Bearer {settings.JINA_API_KEY}"})
            r.raise_for_status()
            data = r.json()["data"]
            # keep input order
            data.sort(key=lambda d: d["index"])
            return [d["embedding"] for d in data]
        except httpx.HTTPStatusError as e:
            raise ProviderError(f"jina embed: {e.response.status_code} {e.response.text[:150]}")
        except Exception as e:  # noqa: BLE001
            raise ProviderError(f"jina embed: {e!r}")


class GeminiEmbeddings(EmbeddingProvider):
    dim = 768  # text-embedding-004

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not settings.GEMINI_API_KEY:
            raise ProviderError("GEMINI_API_KEY missing")
        url = GEMINI_EMBED_URL.format(model=settings.GEMINI_EMBED_MODEL)
        out: list[list[float]] = []
        for t in texts:  # Gemini embedContent is one text per call
            payload = {"content": {"parts": [{"text": t}]}}
            r = await http.post(url, json=payload, params={"key": settings.GEMINI_API_KEY})
            r.raise_for_status()
            out.append(r.json()["embedding"]["values"])
        return out


def build_embedder() -> EmbeddingProvider:
    if settings.EMBED_PROVIDER == "gemini":
        return GeminiEmbeddings()
    return JinaEmbeddings()
