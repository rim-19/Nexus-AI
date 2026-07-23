"""Step 4 verification: seed the eval set on the indexed job_search collection, run it,
print aggregate metrics, and write a markdown report.
Run from backend/:  .venv/Scripts/python.exe -m scripts.run_seed_eval
"""
import asyncio, json, sys, os
sys.stdout.reconfigure(encoding="utf-8")
from sqlalchemy import select
from app.db.session import SessionLocal, engine
from app.db.models import Document, Collection, EvalSet, EvalItem
from app.eval.runner import run_eval_set, report_to_markdown
from app.providers.base import http as ai_http

SEED = os.path.join(os.path.dirname(__file__), "..", "eval_seed", "job_search_eval.json")
OUT = os.path.join(os.path.dirname(__file__), "..", "eval_seed", "last_report.md")


async def main():
    seed = json.load(open(SEED, encoding="utf-8"))
    async with SessionLocal() as db:
        doc = await db.scalar(
            select(Document).where(Document.source_ref == "rim-19/job_search", Document.status == "ready"))
        if not doc:
            print("No indexed job_search collection found — run scripts.test_step2 first."); return
        cid = doc.collection_id

        es = EvalSet(collection_id=cid, name=seed["name"])
        db.add(es); await db.flush()
        for it in seed["items"]:
            db.add(EvalItem(eval_set_id=es.id, question=it["question"],
                            expected_answer=it.get("expected_answer"), gold_source=it.get("gold_source")))
        await db.commit(); await db.refresh(es)

        print(f"Running eval '{es.name}' ({len(seed['items'])} items) on collection {cid}…\n")
        report = await run_eval_set(db, es.id)

    m = report["metrics"]
    print("=== AGGREGATE METRICS ===")
    print(f"  retrieval recall@retrieve : {m['recall_at_retrieve']}")
    print(f"  retrieval recall@rerank   : {m['recall_at_rerank']}")
    print(f"  faithfulness              : {m['faithfulness']}")
    print(f"  answer correctness        : {m['correctness']}")
    print("\n=== PER-ITEM ===")
    for i, it in enumerate(report["items"], 1):
        print(f"  {i:2d}. rec_ret={it['recall_at_retrieve']} rec_rr={it['recall_at_rerank']} "
              f"faith={it['faithfulness']} corr={it['correctness']}  | {it['question'][:52]}")

    open(OUT, "w", encoding="utf-8").write(report_to_markdown(report))
    print(f"\nMarkdown report written -> {os.path.normpath(OUT)}")

    await ai_http.aclose(); await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
