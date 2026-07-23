"""Build the grounded prompt + structured citations from reranked chunks."""
from __future__ import annotations

SYSTEM = (
    "You are a precise engineering assistant that answers questions about a "
    "codebase and documents using ONLY the provided context.\n"
    "Rules:\n"
    "- Answer strictly from the numbered context below. Do not use outside knowledge.\n"
    "- Cite the sources you use inline with their bracket number, e.g. [1], [2].\n"
    "- If the context does not contain the answer, say exactly: "
    "\"I don't have enough information in the indexed sources to answer that.\"\n"
    "- Be concise and technical. Prefer file names and function names when relevant."
)


def _source_label(meta: dict) -> str:
    fp = meta.get("file_path") or "document"
    if meta.get("start_line") and meta.get("end_line"):
        return f"{fp}:{meta['start_line']}-{meta['end_line']}"
    if meta.get("page"):
        return f"{fp} p.{meta['page']}"
    return fp


def build_context(chunks: list) -> str:
    blocks = []
    for i, c in enumerate(chunks, 1):
        blocks.append(f"[{i}] Source: {_source_label(c.meta)}\n{c.content}")
    return "\n\n".join(blocks)


def build_user_prompt(question: str, chunks: list, history: str = "") -> str:
    ctx = build_context(chunks)
    hist = f"Conversation so far:\n{history}\n\n" if history else ""
    return f"{hist}Context:\n{ctx}\n\nQuestion: {question}\n\nAnswer (cite with [n]):"


def build_citations(chunks: list) -> list[dict]:
    out = []
    for i, c in enumerate(chunks, 1):
        m = c.meta or {}
        out.append({
            "index": i,
            "document_id": str(c.document_id),
            "file_path": m.get("file_path"),
            "start_line": m.get("start_line"),
            "end_line": m.get("end_line"),
            "page": m.get("page"),
            "symbol_name": m.get("symbol_name"),
            "label": _source_label(m),
            "snippet": (c.content[:200] + "…") if len(c.content) > 200 else c.content,
        })
    return out
