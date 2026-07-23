"""LLM generation providers + a fallback chain.

Default chain (validated live): Groq qwen/qwen3.6-27b -> gpt-oss-120b
-> llama-3.3-70b -> Gemini 2.5 Pro (when its quota is available).
"""
from __future__ import annotations
import re
import json
import asyncio
import httpx
from ..config import settings
from .base import LLMProvider, ProviderError, http

_RETRY_AFTER = re.compile(r"try again in ([\d.]+)s", re.IGNORECASE)
MAX_RETRIES = 4


def _retry_delay(body: str, attempt: int) -> float:
    m = _RETRY_AFTER.search(body)
    if m:
        return min(float(m.group(1)) + 0.5, 30.0)
    return min(2.0 * (2 ** attempt), 30.0)  # 2,4,8,16 → capped

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def _reasoning_params(model: str) -> dict:
    """Groq reasoning models waste the whole token budget on chain-of-thought
    unless told otherwise. qwen3 accepts only reasoning_effort none|default;
    gpt-oss/deepseek/qwq use reasoning_format=hidden. (validated live)"""
    m = model.lower()
    if "qwen" in m:
        return {"reasoning_effort": "none"}       # fast, direct answer
    if any(t in m for t in ("gpt-oss", "deepseek", "qwq")):
        return {"reasoning_format": "hidden"}
    return {}


def strip_reasoning(text: str) -> str:
    """Belt-and-suspenders: remove any <think>...</think> that slips through.
    Also drops a dangling, unclosed <think> prefix (model truncated mid-thought)."""
    text = _THINK_RE.sub("", text)
    if "</think>" not in text and "<think>" in text:
        text = text.split("<think>", 1)[0]
    return text.strip()


class GroqLLM(LLMProvider):
    def __init__(self, model: str):
        self.model = model

    async def generate(self, system, user, *, max_tokens=1024, temperature=0.2) -> str:
        if not settings.GROQ_API_KEY:
            raise ProviderError("GROQ_API_KEY missing")
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system},
                         {"role": "user", "content": user}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        payload.update(_reasoning_params(self.model))
        for attempt in range(MAX_RETRIES + 1):
            try:
                r = await http.post(GROQ_URL, json=payload,
                                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"})
                if r.status_code in (429, 500, 502, 503) and attempt < MAX_RETRIES:
                    await asyncio.sleep(_retry_delay(r.text, attempt))
                    continue
                r.raise_for_status()
                return strip_reasoning(r.json()["choices"][0]["message"]["content"])
            except httpx.HTTPStatusError as e:
                raise ProviderError(f"groq {self.model}: {e.response.status_code} {e.response.text[:150]}")
            except httpx.HTTPError as e:
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(_retry_delay("", attempt))
                    continue
                raise ProviderError(f"groq {self.model}: {e!r}")
        raise ProviderError(f"groq {self.model}: exhausted retries")

    async def stream(self, system, user, *, max_tokens=1024, temperature=0.2):
        if not settings.GROQ_API_KEY:
            raise ProviderError("GROQ_API_KEY missing")
        payload = {
            "model": self.model, "stream": True, "max_tokens": max_tokens, "temperature": temperature,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        payload.update(_reasoning_params(self.model))
        for attempt in range(MAX_RETRIES + 1):
            try:
                async with http.stream("POST", GROQ_URL, json=payload,
                                       headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"}) as r:
                    if r.status_code in (429, 500, 502, 503) and attempt < MAX_RETRIES:
                        await asyncio.sleep(_retry_delay((await r.aread()).decode(), attempt))
                        continue
                    if r.status_code != 200:
                        body = (await r.aread()).decode()[:150]
                        raise ProviderError(f"groq {self.model}: {r.status_code} {body}")
                    async for line in r.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            break
                        try:
                            delta = json.loads(data)["choices"][0]["delta"].get("content")
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue
                        if delta:
                            yield delta
                    return
            except httpx.HTTPError as e:
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(_retry_delay("", attempt))
                    continue
                raise ProviderError(f"groq {self.model} stream: {e!r}")


class GeminiLLM(LLMProvider):
    def __init__(self, model: str):
        self.model = model

    async def generate(self, system, user, *, max_tokens=1024, temperature=0.2) -> str:
        if not settings.GEMINI_API_KEY:
            raise ProviderError("GEMINI_API_KEY missing")
        url = GEMINI_URL.format(model=self.model)
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"parts": [{"text": user}]}],
            "generationConfig": {"maxOutputTokens": max_tokens, "temperature": temperature},
        }
        try:
            r = await http.post(url, json=payload, params={"key": settings.GEMINI_API_KEY})
            r.raise_for_status()
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except httpx.HTTPStatusError as e:
            raise ProviderError(f"gemini {self.model}: {e.response.status_code} {e.response.text[:150]}")
        except Exception as e:  # noqa: BLE001
            raise ProviderError(f"gemini {self.model}: {e!r}")


class ChainedLLM(LLMProvider):
    """Tries each provider in order; returns the first success."""
    def __init__(self, chain: list[LLMProvider]):
        self.chain = chain

    async def generate(self, system, user, *, max_tokens=1024, temperature=0.2) -> str:
        errors = []
        for provider in self.chain:
            try:
                return await provider.generate(system, user, max_tokens=max_tokens,
                                               temperature=temperature)
            except ProviderError as e:
                errors.append(str(e))
        raise ProviderError("all LLM providers failed -> " + " | ".join(errors))

    async def stream(self, system, user, *, max_tokens=1024, temperature=0.2):
        """Fall back to the next provider only if the current one fails BEFORE
        emitting any token (can't recover mid-stream)."""
        errors = []
        for provider in self.chain:
            started = False
            try:
                async for chunk in provider.stream(system, user, max_tokens=max_tokens,
                                                   temperature=temperature):
                    started = True
                    yield chunk
                return
            except ProviderError as e:
                errors.append(str(e))
                if started:
                    raise
        raise ProviderError("all LLM providers failed -> " + " | ".join(errors))


def build_llm() -> ChainedLLM:
    """Build the default generation chain from settings."""
    chain: list[LLMProvider] = []
    if settings.LLM_PROVIDER == "gemini":
        chain.append(GeminiLLM(settings.GEMINI_MODEL))
    # Groq primary + fallbacks
    chain.append(GroqLLM(settings.GROQ_MODEL_PRIMARY))
    chain.extend(GroqLLM(m) for m in settings.groq_fallback_list)
    # Gemini as a last resort if not already primary
    if settings.LLM_PROVIDER != "gemini":
        chain.append(GeminiLLM(settings.GEMINI_MODEL))
    return ChainedLLM(chain)
