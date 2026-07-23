"""Run an eval set through the real RAG pipeline and score it."""
from __future__ import annotations
import uuid
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db.models import EvalSet, EvalItem
from ..providers import llm
from ..retrieval.hybrid_search import hybrid_search
from ..retrieval.prompt_builder import SYSTEM, build_user_prompt
from ..rag.orchestrator import _rerank
from . import metrics

REFUSAL = "I don't have enough information in the indexed sources to answer that."


def _mean(vals: list) -> float | None:
    vals = [v for v in vals if v is not None]
    return round(sum(vals) / len(vals), 3) if vals else None


async def run_eval_set(db: AsyncSession, eval_set_id: uuid.UUID) -> dict:
    es = await db.get(EvalSet, eval_set_id)
    if not es:
        raise ValueError("eval set not found")
    items = list(await db.scalars(select(EvalItem).where(EvalItem.eval_set_id == eval_set_id)))
    scope = {"type": "collection", "id": str(es.collection_id)}

    per_item, recalls_r, recalls_k, faiths, corrs = [], [], [], [], []
    for idx, it in enumerate(items):
        if idx:
            await asyncio.sleep(1.0)  # gentle pacing for free-tier rate limits
        candidates = await hybrid_search(db, it.question, scope, settings.TOP_K_RETRIEVE)
        reranked = await _rerank(it.question, candidates, settings.TOP_K_RERANK)

        if reranked:
            answer = await llm.generate(SYSTEM, build_user_prompt(it.question, reranked), max_tokens=700)
        else:
            answer = REFUSAL

        rec_r = metrics.recall_at_k(it.gold_source, candidates)   # over retrieved (top 20)
        rec_k = metrics.recall_at_k(it.gold_source, reranked)     # over reranked (top 5)
        faith = await metrics.faithfulness(answer, reranked)
        corr = (await metrics.correctness(it.question, it.expected_answer, answer)
                if it.expected_answer else {"score": None, "reason": "no reference"})

        recalls_r.append(rec_r); recalls_k.append(rec_k)
        faiths.append(faith["score"]); corrs.append(corr["score"])
        per_item.append({
            "question": it.question,
            "gold_source": it.gold_source,
            "answer": answer[:400],
            "retrieved_files": [ (c.meta or {}).get("file_path") for c in candidates[:8] ],
            "recall_at_retrieve": rec_r, "recall_at_rerank": rec_k,
            "faithfulness": faith["score"], "faithfulness_reason": faith["reason"],
            "correctness": corr["score"], "correctness_reason": corr["reason"],
        })

    return {
        "eval_set": es.name,
        "collection_id": str(es.collection_id),
        "n_items": len(items),
        "metrics": {
            "recall_at_retrieve": _mean(recalls_r),
            "recall_at_rerank": _mean(recalls_k),
            "faithfulness": _mean(faiths),
            "correctness": _mean(corrs),
        },
        "items": per_item,
    }


def report_to_markdown(report: dict) -> str:
    m = report["metrics"]
    lines = [
        f"# Eval report — {report['eval_set']}",
        f"Items: {report['n_items']}  |  Collection: `{report['collection_id']}`\n",
        "## Aggregate",
        f"- Retrieval recall@{settings.TOP_K_RETRIEVE}: **{m['recall_at_retrieve']}**",
        f"- Retrieval recall@{settings.TOP_K_RERANK} (reranked): **{m['recall_at_rerank']}**",
        f"- Faithfulness: **{m['faithfulness']}**",
        f"- Answer correctness: **{m['correctness']}**\n",
        "## Per-item",
        "| # | Question | recall@ret | recall@rr | faith | correct |",
        "|---|----------|-----------|-----------|-------|---------|",
    ]
    for i, it in enumerate(report["items"], 1):
        lines.append(f"| {i} | {it['question'][:60]} | {it['recall_at_retrieve']} | "
                     f"{it['recall_at_rerank']} | {it['faithfulness']} | {it['correctness']} |")
    return "\n".join(lines)
