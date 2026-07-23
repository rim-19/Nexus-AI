"""Ingestion orchestrator: load -> chunk -> embed -> store.

Runs as a background task with its own DB session. Updates Document.status
(pending -> indexing -> ready|failed) so the UI can poll.
"""
from __future__ import annotations
import uuid

from sqlalchemy import delete

from ..db.session import SessionLocal
from ..db.models import Document, Chunk
from ..providers import embedder
from .chunking import chunk_file, LoadedFile
from .loaders.github import load_github
from .loaders.files import load_upload

EMBED_BATCH = 32


async def _embed_all(texts: list[str]) -> list[list[float]]:
    out: list[list[float]] = []
    for i in range(0, len(texts), EMBED_BATCH):
        out.extend(await embedder.embed(texts[i:i + EMBED_BATCH]))
    return out


async def ingest_document(document_id: uuid.UUID,
                          upload: tuple[str, bytes] | None = None) -> None:
    """upload = (filename, bytes) for uploaded files; None for GitHub (uses source_ref)."""
    async with SessionLocal() as db:
        doc = await db.get(Document, document_id)
        if not doc:
            return
        doc.status = "indexing"
        await db.commit()

        try:
            # 1. load
            if doc.source_type == "github":
                loaded: list[LoadedFile] = await load_github(doc.source_ref)
            else:
                assert upload is not None, "upload bytes required for file sources"
                loaded = load_upload(upload[0], upload[1], doc.source_type)

            # 2. chunk
            chunks: list[dict] = []
            for lf in loaded:
                chunks.extend(chunk_file(lf))
            if not chunks:
                raise ValueError("No indexable content found")

            # 3. embed
            vectors = await _embed_all([c["content"] for c in chunks])

            # 4. store (replace any prior chunks for idempotent re-index)
            await db.execute(delete(Chunk).where(Chunk.document_id == doc.id))
            for ordinal, (c, vec) in enumerate(zip(chunks, vectors)):
                db.add(Chunk(
                    document_id=doc.id, collection_id=doc.collection_id,
                    ordinal=ordinal, content=c["content"],
                    token_count=c["token_count"], meta=c["metadata"], embedding=vec,
                ))
            doc.num_chunks = len(chunks)
            doc.status = "ready"
            doc.error = None
            await db.commit()

        except Exception as e:  # noqa: BLE001
            await db.rollback()
            doc = await db.get(Document, document_id)
            if doc:
                doc.status = "failed"
                doc.error = str(e)[:500]
                await db.commit()
