"""Chunking.

Code -> structure-aware chunks (one per function/class via tree-sitter),
carrying file_path + start_line/end_line + symbol_name.
Prose -> token-window chunks (~CHUNK_TOKENS, CHUNK_OVERLAP), carrying page (PDFs).

Every chunk is a dict: {content, token_count, metadata}. Ordinals are assigned
by the pipeline across the whole document.
"""
from __future__ import annotations
from dataclasses import dataclass, field
import tiktoken

from ..config import settings

_enc = tiktoken.get_encoding("cl100k_base")

# extension -> tree-sitter language name (tree-sitter-language-pack)
CODE_LANGS = {
    "py": "python", "js": "javascript", "jsx": "javascript", "ts": "typescript",
    "tsx": "tsx", "go": "go", "java": "java", "rb": "ruby", "rs": "rust",
    "c": "c", "h": "c", "cpp": "cpp", "cc": "cpp", "hpp": "cpp",
    "cs": "c_sharp", "php": "php", "kt": "kotlin", "swift": "swift", "scala": "scala",
}
_DEF_TYPES = ("function_definition", "class_definition", "decorated_definition",
              "method_definition", "function_declaration", "class_declaration")


@dataclass
class LoadedFile:
    path: str
    content: str
    kind: str  # "code" | "text"
    language: str | None = None
    page: int | None = None
    extra: dict = field(default_factory=dict)


def count_tokens(text: str) -> int:
    return len(_enc.encode(text, disallowed_special=()))


def lang_for(path: str) -> str | None:
    ext = path.rsplit(".", 1)[-1].lower() if "." in path.split("/")[-1] else ""
    return CODE_LANGS.get(ext)


def _mk(lf: LoadedFile, content: str, meta_extra: dict) -> dict:
    meta = {"file_path": lf.path, "language": lf.language}
    if lf.page is not None:
        meta["page"] = lf.page
    meta.update(meta_extra)
    return {"content": content, "token_count": count_tokens(content), "metadata": meta}


# ---------------- prose ----------------
def chunk_text(lf: LoadedFile) -> list[dict]:
    toks = _enc.encode(lf.content, disallowed_special=())
    if not toks:
        return []
    size, overlap = settings.CHUNK_TOKENS, settings.CHUNK_OVERLAP
    step = max(1, size - overlap)
    out = []
    for i in range(0, len(toks), step):
        window = toks[i:i + size]
        text = _enc.decode(window).strip()
        if text:
            out.append(_mk(lf, text, {}))
        if i + size >= len(toks):
            break
    return out


# ---------------- code ----------------
def _name(node) -> str | None:
    for c in node.children:
        if c.type in ("identifier", "type_identifier", "name", "property_identifier"):
            return c.text.decode("utf-8", "ignore")
    # decorated_definition wraps the real def
    for c in node.children:
        if c.type in _DEF_TYPES:
            return _name(c)
    return None


def _window_lines(lf: LoadedFile, lines: list[str], start_line: int, symbol: str) -> list[dict]:
    """Line-window a large unit into <=CHUNK_TOKENS pieces (keeps line ranges)."""
    out, buf, buf_start = [], [], start_line
    for idx, ln in enumerate(lines):
        buf.append(ln)
        if count_tokens("\n".join(buf)) >= settings.CHUNK_TOKENS:
            text = "\n".join(buf)
            out.append(_mk(lf, text, {"start_line": buf_start, "end_line": start_line + idx,
                                      "symbol_name": symbol}))
            buf, buf_start = [], start_line + idx + 1
    if buf and "\n".join(buf).strip():
        out.append(_mk(lf, "\n".join(buf), {"start_line": buf_start,
                                            "end_line": start_line + len(lines) - 1,
                                            "symbol_name": symbol}))
    return out


def chunk_code(lf: LoadedFile) -> list[dict]:
    from tree_sitter_language_pack import get_parser
    try:
        parser = get_parser(lf.language)
    except Exception:
        return chunk_text(lf)

    data = lf.content.encode("utf-8", "ignore")
    root = parser.parse(data).root_node
    lines = lf.content.split("\n")
    chunks: list[dict] = []
    preamble: list = []

    def flush_preamble():
        if not preamble:
            return
        s, e = preamble[0].start_point[0], preamble[-1].end_point[0]
        text = "\n".join(lines[s:e + 1]).strip()
        if text:
            chunks.append(_mk(lf, text, {"start_line": s + 1, "end_line": e + 1,
                                         "symbol_name": "<module>"}))
        preamble.clear()

    for node in root.children:
        if node.type in _DEF_TYPES:
            flush_preamble()
            text = node.text.decode("utf-8", "ignore")
            s, e = node.start_point[0] + 1, node.end_point[0] + 1
            symbol = _name(node) or node.type
            if count_tokens(text) <= settings.CHUNK_TOKENS:
                chunks.append(_mk(lf, text, {"start_line": s, "end_line": e, "symbol_name": symbol}))
            else:
                chunks.extend(_window_lines(lf, text.split("\n"), s, symbol))
        else:
            preamble.append(node)
    flush_preamble()

    return chunks or chunk_text(lf)


def chunk_file(lf: LoadedFile) -> list[dict]:
    if lf.kind == "code" and lf.language:
        return chunk_code(lf)
    return chunk_text(lf)
