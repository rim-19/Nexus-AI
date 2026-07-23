"""Document loaders for uploaded files: PDF (per page), DOCX, MD/TXT."""
from __future__ import annotations
import io

from ..chunking import LoadedFile


def load_pdf(filename: str, data: bytes) -> list[LoadedFile]:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    out = []
    for i, page in enumerate(reader.pages):
        text = (page.extract_text() or "").strip()
        if text:
            out.append(LoadedFile(path=filename, content=text, kind="text", page=i + 1))
    return out


def load_docx(filename: str, data: bytes) -> list[LoadedFile]:
    from docx import Document as Docx
    doc = Docx(io.BytesIO(data))
    text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return [LoadedFile(path=filename, content=text, kind="text")] if text.strip() else []


def load_plain(filename: str, data: bytes) -> list[LoadedFile]:
    text = data.decode("utf-8", "ignore")
    return [LoadedFile(path=filename, content=text, kind="text")] if text.strip() else []


def load_upload(filename: str, data: bytes, source_type: str) -> list[LoadedFile]:
    if source_type == "pdf":
        return load_pdf(filename, data)
    if source_type == "docx":
        return load_docx(filename, data)
    return load_plain(filename, data)  # md | txt
