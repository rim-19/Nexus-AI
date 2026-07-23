"""Evaluation metrics.

- recall_at_k: did retrieval surface the gold source file? (retrieval quality, no LLM)
- faithfulness: LLM-judge — is every claim in the answer supported by the context?
- correctness: LLM-judge — does the answer match the expected answer?
"""
from __future__ import annotations
import json
import re

from ..providers import llm

_JSON = re.compile(r"\{.*\}", re.DOTALL)

_FAITH_SYS = (
    "You are a strict evaluation judge. Given CONTEXT and an ANSWER, decide whether every "
    "factual claim in the ANSWER is supported by the CONTEXT. Reply ONLY with JSON: "
    '{"score": <0.0-1.0>, "reason": "<short>"}. 1.0 = fully grounded, 0.0 = unsupported/hallucinated.'
)
_CORRECT_SYS = (
    "You are a strict evaluation judge. Given a QUESTION, a REFERENCE answer, and a MODEL answer, "
    "decide whether the MODEL answer is correct and consistent with the REFERENCE. Reply ONLY with "
    'JSON: {"score": <0.0-1.0>, "reason": "<short>"}. 1.0 = correct, 0.0 = wrong.'
)


async def _judge(system: str, user: str) -> dict:
    raw = await llm.generate(system, user, max_tokens=250, temperature=0.0)
    m = _JSON.search(raw)
    if m:
        try:
            d = json.loads(m.group(0))
            return {"score": float(d.get("score", 0.0)), "reason": str(d.get("reason", ""))[:200]}
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
    n = re.search(r"(\d(?:\.\d+)?)", raw)
    return {"score": float(n.group(1)) if n else 0.0, "reason": raw[:150]}


def recall_at_k(gold_source: str | None, chunks: list) -> float | None:
    """1.0 if any chunk's file_path/symbol matches gold_source, else 0.0. None if no gold."""
    if not gold_source:
        return None
    g = gold_source.lower()
    for c in chunks:
        m = c.meta or {}
        fp = (m.get("file_path") or "").lower()
        sym = (m.get("symbol_name") or "").lower()
        if g in fp or fp.endswith(g) or g in sym:
            return 1.0
    return 0.0


async def faithfulness(answer: str, chunks: list) -> dict:
    context = "\n\n".join(c.content for c in chunks) or "(no context)"
    return await _judge(_FAITH_SYS, f"CONTEXT:\n{context}\n\nANSWER:\n{answer}\n\nJSON:")


async def correctness(question: str, expected: str, answer: str) -> dict:
    return await _judge(
        _CORRECT_SYS,
        f"QUESTION:\n{question}\n\nREFERENCE:\n{expected}\n\nMODEL:\n{answer}\n\nJSON:")
