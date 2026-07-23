"""Provider interfaces + a shared async HTTP client.

Groq and Jina sit behind Cloudflare, which blocks the default python-httpx
User-Agent with `error code: 1010`. We send a browser-like UA to avoid that.
Every external AI vendor call MUST go through this module.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
import httpx

_BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# One shared client (connection pooling). Reused across requests.
http = httpx.AsyncClient(
    timeout=httpx.Timeout(60.0),
    headers={"User-Agent": _BROWSER_UA, "Accept": "application/json"},
)


class ProviderError(RuntimeError):
    """Raised when a provider call fails (so the chain can fall back)."""


class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, system: str, user: str, *, max_tokens: int = 1024,
                       temperature: float = 0.2) -> str:
        ...

    async def stream(self, system: str, user: str, *, max_tokens: int = 1024,
                     temperature: float = 0.2):
        """Default: no real streaming — emit the whole answer as one chunk.
        Providers that support SSE override this."""
        yield await self.generate(system, user, max_tokens=max_tokens, temperature=temperature)


class EmbeddingProvider(ABC):
    dim: int

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        ...


class RerankProvider(ABC):
    @abstractmethod
    async def rerank(self, query: str, documents: list[str], top_n: int) -> list[tuple[int, float]]:
        """Return [(original_index, relevance_score), ...] sorted best-first."""
        ...
