"""Document routes: add a source (GitHub URL or uploaded file), list, status, delete.
Indexing runs in the background; poll GET /documents/{id} for status."""
from __future__ import annotations
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from ..db.models import User, Document, Chunk
from ..schemas import DocumentOut
from ..jobs import enqueue
from ..storage import storage
from .deps import get_current_user, require_collection_access

router = APIRouter(prefix="/api/v1", tags=["documents"])

_EXT_TO_TYPE = {"pdf": "pdf", "docx": "docx", "doc": "docx",
                "md": "md", "markdown": "md", "txt": "txt", "text": "txt"}


@router.post("/collections/{collection_id}/documents", response_model=DocumentOut, status_code=201)
async def add_document(
    collection_id: uuid.UUID,
    github_url: str | None = Form(None),
    file: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_collection_access(collection_id, user, db)

    if github_url:
        doc = Document(collection_id=collection_id, source_type="github",
                       source_ref=github_url, status="pending")
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
        await enqueue(doc.id)               # durable job (survives restarts + retries)
        return doc

    if file is not None:
        ext = (file.filename or "").rsplit(".", 1)[-1].lower()
        source_type = _EXT_TO_TYPE.get(ext)
        if not source_type:
            raise HTTPException(status.HTTP_400_BAD_REQUEST,
                                f"Unsupported file type '.{ext}'. Allowed: pdf, docx, md, txt")
        data = await file.read()
        doc = Document(collection_id=collection_id, source_type=source_type,
                       source_ref=file.filename, status="pending")
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
        path = await storage.save(str(doc.id), file.filename or "upload", data)  # persist the file
        doc.storage_path = path
        await db.commit()
        await enqueue(doc.id, upload_path=path)
        return doc

    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide either github_url or a file")


@router.get("/collections/{collection_id}/documents", response_model=list[DocumentOut])
async def list_documents(collection_id: uuid.UUID, user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    await require_collection_access(collection_id, user, db)
    rows = await db.scalars(
        select(Document).where(Document.collection_id == collection_id).order_by(Document.created_at))
    return list(rows)


@router.get("/documents/{document_id}", response_model=DocumentOut)
async def get_document(document_id: uuid.UUID, user: User = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    await require_collection_access(doc.collection_id, user, db)
    return doc


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(document_id: uuid.UUID, user: User = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    await require_collection_access(doc.collection_id, user, db)
    await db.delete(doc)   # chunks cascade
    await db.commit()


@router.get("/documents/{document_id}/overview")
async def document_overview(document_id: uuid.UUID,
                           user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """AI repository intelligence report — cached on the document, generated on first request."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    await require_collection_access(doc.collection_id, user, db)
    if doc.source_type != "github":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Overview is only available for repositories")
    if doc.status != "ready":
        return {"status": doc.status, "overview": None}
    if doc.overview:
        return {"status": "ready", "overview": doc.overview}
    from ..rag.overview import generate_overview
    report = await generate_overview(db, document_id)
    return {"status": "ready" if report else "unavailable", "overview": report}


@router.get("/documents/{document_id}/files")
async def document_files(document_id: uuid.UUID,
                         user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """File breakdown (path, chunk count, tokens) for graph + analytics views."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    await require_collection_access(doc.collection_id, user, db)

    fp = Chunk.meta["file_path"].astext
    rows = await db.execute(
        select(fp.label("file_path"), func.count().label("chunks"),
               func.coalesce(func.sum(Chunk.token_count), 0).label("tokens"))
        .where(Chunk.document_id == document_id)
        .group_by(fp).order_by(func.count().desc()))
    return {
        "document_id": str(document_id),
        "source_ref": doc.source_ref,
        "files": [{"file_path": r.file_path, "chunks": r.chunks, "tokens": int(r.tokens)}
                  for r in rows if r.file_path],
    }


@router.get("/documents/{document_id}/source")
async def document_source(document_id: uuid.UUID, file_path: str | None = None,
                          user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Reconstruct a file's indexed content (ordered chunks) so a citation can be opened."""
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    await require_collection_access(doc.collection_id, user, db)

    stmt = select(Chunk).where(Chunk.document_id == document_id)
    if file_path:
        stmt = stmt.where(Chunk.meta["file_path"].astext == file_path)
    stmt = stmt.order_by(Chunk.ordinal)
    chunks = list(await db.scalars(stmt))

    return {
        "document_id": str(document_id),
        "source_ref": doc.source_ref,
        "source_type": doc.source_type,
        "file_path": file_path,
        "chunks": [
            {
                "ordinal": c.ordinal,
                "content": c.content,
                "start_line": (c.meta or {}).get("start_line"),
                "end_line": (c.meta or {}).get("end_line"),
                "page": (c.meta or {}).get("page"),
                "symbol_name": (c.meta or {}).get("symbol_name"),
                "language": (c.meta or {}).get("language"),
            }
            for c in chunks
        ],
    }

