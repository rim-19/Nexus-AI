"""Generate an AI 'repository intelligence' report from indexed content, cached on the document."""
from __future__ import annotations
import json
import re
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Document, Chunk
from ..providers import llm
from ..providers.base import ProviderError

_JSON = re.compile(r"\{.*\}", re.DOTALL)

SYSTEM = (
    "You are a senior software engineer producing a concise repository intelligence report. "
    "Analyze the provided file tree and README, then respond with ONLY a JSON object using exactly "
    "these keys: language (string), framework (string or null), architecture (short string), "
    "summary (2-3 sentences), key_technologies (array of strings), modules (array of strings), "
    "key_files (array of file paths), complexity (\"Low\"|\"Moderate\"|\"High\"), "
    "security_notes (array of short strings). Base everything ONLY on the given data. "
    "Use null or [] when unknown. No prose outside the JSON."
)


async def generate_overview(db: AsyncSession, document_id: uuid.UUID) -> dict | None:
    doc = await db.get(Document, document_id)
    if not doc or doc.source_type != "github":
        return None

    fp = Chunk.meta["file_path"].astext
    rows = await db.execute(
        select(fp.label("f"), func.count().label("n")).where(Chunk.document_id == document_id)
        .group_by(fp).order_by(func.count().desc()))
    files = [(r.f, r.n) for r in rows if r.f]
    if not files:
        return None

    file_tree = "\n".join(f"{f} ({n} chunks)" for f, n in files[:60])

    readme_rows = await db.scalars(
        select(Chunk.content).where(Chunk.document_id == document_id, fp.ilike("%readme%"))
        .order_by(Chunk.ordinal).limit(6))
    readme = "\n".join(readme_rows)[:2500]

    prompt = (
        f"Repository: {doc.source_ref}\n\n"
        f"FILE TREE (top files by size):\n{file_tree}\n\n"
        f"README:\n{readme or '(none)'}\n\nJSON report:"
    )

    try:
        raw = await llm.generate(SYSTEM, prompt, max_tokens=900, temperature=0.2)
    except ProviderError:
        return None

    m = _JSON.search(raw)
    if not m:
        return None
    try:
        report = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None

    report["files_indexed"] = len(files)
    doc.overview = report
    await db.commit()
    return report
