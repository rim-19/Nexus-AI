"""Singletons for the app to import."""
from .llm import build_llm
from .embeddings import build_embedder
from .rerank import build_reranker

llm = build_llm()
embedder = build_embedder()
reranker = build_reranker()

__all__ = ["llm", "embedder", "reranker"]
