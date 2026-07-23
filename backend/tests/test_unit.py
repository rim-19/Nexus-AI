"""Fast unit tests (no DB/network): security, RRF fusion, chunking, config."""
import uuid

from app.core.security import (
    hash_password, verify_password, create_access_token, decode_token,
)
from app.retrieval.hybrid_search import _rrf
from app.ingestion.chunking import chunk_file, LoadedFile, count_tokens
from app.config import Settings


# ---------- security ----------
def test_password_hash_and_verify():
    h = hash_password("secret123")
    assert h != "secret123"
    assert verify_password("secret123", h)
    assert not verify_password("wrong", h)


def test_jwt_roundtrip_and_kind():
    uid = str(uuid.uuid4())
    tok = create_access_token(uid)
    assert decode_token(tok, "access")["sub"] == uid
    assert decode_token(tok, "refresh") is None      # wrong kind rejected
    assert decode_token("garbage.token", "access") is None


# ---------- reciprocal rank fusion ----------
def test_rrf_merges_and_ranks():
    a, b, c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    fused = _rrf([a, b, c], [a, c, b])   # a is top in both lists
    assert fused[0] == a
    assert set(fused) == {a, b, c}


def test_rrf_union_of_ids():
    a, b, c, d = (uuid.uuid4() for _ in range(4))
    fused = _rrf([a, b], [c, d])
    assert set(fused) == {a, b, c, d}


# ---------- structure-aware code chunking ----------
def test_code_chunking_extracts_symbols_and_lines():
    code = "import os\n\ndef foo(x):\n    return x + 1\n\nclass Bar:\n    def baz(self):\n        return 2\n"
    lf = LoadedFile(path="a.py", content=code, kind="code", language="python")
    chunks = chunk_file(lf)
    syms = [c["metadata"].get("symbol_name") for c in chunks]
    assert "foo" in syms
    assert any((s or "").startswith(("Bar", "baz")) or s == "Bar" for s in syms)
    for c in chunks:
        assert c["metadata"]["file_path"] == "a.py"
        assert c["token_count"] > 0


def test_prose_chunking_splits_long_text():
    lf = LoadedFile(path="d.txt", content="word " * 3000, kind="text")
    chunks = chunk_file(lf)
    assert len(chunks) >= 2
    assert all(c["token_count"] > 0 for c in chunks)


def test_count_tokens_nonzero():
    assert count_tokens("hello world") > 0


# ---------- config URL normalization ----------
def test_async_db_url_normalization():
    s = Settings(DATABASE_URL="postgresql://u:p@host:5432/db?schema=public")
    assert s.async_db_url == "postgresql+asyncpg://u:p@host:5432/db"
    assert s.sync_db_url == "postgresql://u:p@host:5432/db"
