"""Durable ingestion queue backed by Postgres.

Unlike FastAPI BackgroundTasks (which lose work on restart), jobs persist in
`ingestion_jobs` and are retried. A worker loop runs inside the app lifespan and
claims jobs atomically with FOR UPDATE SKIP LOCKED.
"""
from __future__ import annotations
import os
import asyncio
import uuid

from sqlalchemy import text

from .db.session import SessionLocal
from .db.models import IngestionJob, Document
from .ingestion.pipeline import ingest_document
from .storage import storage

MAX_ATTEMPTS = 3
POLL_SECONDS = 3.0

_CLAIM = text("""
    update ingestion_jobs set status='running', attempts=attempts+1, updated_at=now()
    where id = (
        select id from ingestion_jobs
        where status='queued' order by created_at limit 1
        for update skip locked
    )
    returning id, document_id, upload_path, attempts
""")


async def enqueue(document_id: uuid.UUID, upload_path: str | None = None) -> None:
    async with SessionLocal() as db:
        db.add(IngestionJob(document_id=document_id, upload_path=upload_path))
        await db.commit()


async def _run_one() -> bool:
    """Claim + process a single job. Returns True if one was handled."""
    async with SessionLocal() as db:
        row = (await db.execute(_CLAIM)).first()
        await db.commit()
        if not row:
            return False
        job_id, document_id, upload_path, attempts = row

    try:
        if upload_path:
            data = await storage.read(upload_path)
            await ingest_document(document_id, (os.path.basename(upload_path), data))
        else:
            await ingest_document(document_id)
        status, error = "done", None
    except Exception as e:  # noqa: BLE001
        # retry until MAX_ATTEMPTS, then fail
        status = "queued" if attempts < MAX_ATTEMPTS else "failed"
        error = str(e)[:500]
        if status == "failed":
            async with SessionLocal() as db:
                doc = await db.get(Document, document_id)
                if doc:
                    doc.status = "failed"; doc.error = error
                    await db.commit()

    async with SessionLocal() as db:
        job = await db.get(IngestionJob, job_id)
        if job:
            job.status = status; job.error = error
            await db.commit()
    return True


async def run_worker(stop: asyncio.Event) -> None:
    """Long-running worker: drains the queue, then polls."""
    while not stop.is_set():
        try:
            handled = await _run_one()
        except Exception:  # noqa: BLE001 — never let the loop die
            handled = False
        if not handled:
            try:
                await asyncio.wait_for(stop.wait(), timeout=POLL_SECONDS)
            except asyncio.TimeoutError:
                pass
