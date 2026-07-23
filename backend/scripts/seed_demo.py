"""Seed demo data so anyone can clone -> run -> try Nexus AI immediately.

Creates a demo user, a collection, indexes the sample GitHub repo + a handbook
document, and seeds an eval set. Idempotent: safe to run more than once.

Run from backend/:  .venv/Scripts/python.exe -m scripts.seed_demo
"""
import asyncio
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")
from sqlalchemy import select

from app.db.session import SessionLocal, engine
from app.db.models import (
    User, Workspace, WorkspaceMember, Collection, Document, EvalSet, EvalItem,
)
from app.core.security import hash_password
from app.ingestion.pipeline import ingest_document
from app.providers.base import http as ai_http

DEMO_EMAIL = "demo@nexus.ai"
DEMO_PASSWORD = "demo1234"
REPO = "rim-19/job_search"
COLLECTION = "Demo — job_search"
HANDBOOK_NAME = "Employee_Handbook.md"
HANDBOOK = (
    "# Employee Handbook\n\n"
    "## Vacation\nEmployees receive 20 vacation days per year.\n\n"
    "## Remote Work\nEmployees may work remotely up to three days per week with manager approval.\n\n"
    "## Sick Leave\nSick leave is unlimited and does not require prior approval.\n"
).encode("utf-8")

SEED_EVAL = os.path.join(os.path.dirname(__file__), "..", "eval_seed", "job_search_eval.json")


async def _get_or_create_user(db) -> User:
    u = await db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if u:
        return u
    u = User(email=DEMO_EMAIL, password_hash=hash_password(DEMO_PASSWORD),
             name="Demo", email_verified=True)
    db.add(u)
    await db.flush()
    ws = Workspace(name="Demo Workspace", owner_user_id=u.id, type="individual")
    db.add(ws)
    await db.flush()
    db.add(WorkspaceMember(workspace_id=ws.id, user_id=u.id, role="owner"))
    await db.commit()
    return u


async def _get_or_create_doc(db, cid, source_type, source_ref) -> tuple:
    doc = await db.scalar(select(Document).where(
        Document.collection_id == cid, Document.source_ref == source_ref))
    if doc and doc.status == "ready":
        return doc.id, False
    if not doc:
        doc = Document(collection_id=cid, source_type=source_type,
                       source_ref=source_ref, status="pending")
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
    return doc.id, True


async def main():
    async with SessionLocal() as db:
        user = await _get_or_create_user(db)
        ws = await db.scalar(select(Workspace).where(Workspace.owner_user_id == user.id))
        col = await db.scalar(select(Collection).where(
            Collection.workspace_id == ws.id, Collection.name == COLLECTION))
        if not col:
            col = Collection(workspace_id=ws.id, name=COLLECTION)
            db.add(col)
            await db.commit()
            await db.refresh(col)
        cid = col.id

        repo_id, repo_new = await _get_or_create_doc(db, cid, "github", REPO)
        doc_id, doc_new = await _get_or_create_doc(db, cid, "md", HANDBOOK_NAME)

    if repo_new:
        print(f"Indexing repo {REPO} … (this calls live embedding APIs, ~1–2 min)")
        await ingest_document(repo_id)
    else:
        print(f"Repo {REPO} already indexed — skipping.")

    if doc_new:
        print(f"Indexing document {HANDBOOK_NAME} …")
        await ingest_document(doc_id, (HANDBOOK_NAME, HANDBOOK))
    else:
        print(f"Document {HANDBOOK_NAME} already indexed — skipping.")

    # eval set
    async with SessionLocal() as db:
        existing_es = await db.scalar(select(EvalSet).where(EvalSet.collection_id == cid))
        if not existing_es and os.path.exists(SEED_EVAL):
            seed = json.load(open(SEED_EVAL, encoding="utf-8"))
            es = EvalSet(collection_id=cid, name=seed["name"])
            db.add(es)
            await db.flush()
            for it in seed["items"]:
                db.add(EvalItem(eval_set_id=es.id, question=it["question"],
                                expected_answer=it.get("expected_answer"),
                                gold_source=it.get("gold_source")))
            await db.commit()
            print(f"Seeded eval set '{seed['name']}' ({len(seed['items'])} questions).")

    await ai_http.aclose()
    await engine.dispose()

    print("\n" + "=" * 52)
    print("  Demo data ready. Sign in at http://localhost:3000")
    print(f"  Email:    {DEMO_EMAIL}")
    print(f"  Password: {DEMO_PASSWORD}")
    print("  Try: \"How does the code load recruiters?\"")
    print("=" * 52)


if __name__ == "__main__":
    asyncio.run(main())
