"""Central configuration. Reads from the project-root .env (never hardcode secrets)."""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# .env lives at the project root (one level above backend/)
ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_PATH, extra="ignore")

    # --- database ---
    # Async SQLAlchemy needs the +asyncpg driver, e.g.
    # postgresql+asyncpg://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres
    DATABASE_URL: str = ""

    # --- auth ---
    JWT_SECRET: str = "change-me-in-env"
    JWT_ALG: str = "HS256"
    JWT_ACCESS_TTL_MIN: int = 15
    JWT_REFRESH_TTL_DAYS: int = 7

    # --- cookies / CORS ---
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    COOKIE_SECURE: bool = False        # True in production (HTTPS)
    COOKIE_SAMESITE: str = "lax"       # "none" (+Secure) for cross-site prod
    ACCESS_COOKIE: str = "nx_access"
    REFRESH_COOKIE: str = "nx_refresh"

    # --- email (dev: links are logged; wire a provider for real delivery) ---
    EMAIL_ENABLED: bool = False
    APP_BASE_URL: str = "http://localhost:3000"

    # --- provider selection ---
    LLM_PROVIDER: str = "groq"        # groq | gemini
    EMBED_PROVIDER: str = "jina"      # jina | gemini
    RERANK_PROVIDER: str = "jina"     # jina | cohere

    # --- keys ---
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    JINA_API_KEY: str = ""
    COHERE_API_KEY: str = ""
    GITHUB_TOKEN: str = ""            # optional: private repos + higher rate limits

    # --- models ---
    # Generation fallback chain is tried left-to-right until one succeeds.
    GROQ_MODEL_PRIMARY: str = "qwen/qwen3.6-27b"
    GROQ_MODEL_FALLBACKS: str = "openai/gpt-oss-120b,llama-3.3-70b-versatile"
    GEMINI_MODEL: str = "gemini-2.5-pro"

    # Embeddings: Jina v3 => 1024 dims. Changing provider/dim requires re-indexing.
    JINA_EMBED_MODEL: str = "jina-embeddings-v3"
    GEMINI_EMBED_MODEL: str = "text-embedding-004"
    EMBED_DIM: int = 1024

    # Reranking
    JINA_RERANK_MODEL: str = "jina-reranker-v2-base-multilingual"
    COHERE_RERANK_MODEL: str = "rerank-v3.5"

    # --- ingestion tuning ---
    MAX_REPO_MB: int = 100
    MAX_FILE_KB: int = 512
    CHUNK_TOKENS: int = 800
    CHUNK_OVERLAP: int = 120
    TOP_K_RETRIEVE: int = 20
    TOP_K_RERANK: int = 5

    @property
    def groq_fallback_list(self) -> list[str]:
        return [m.strip() for m in self.GROQ_MODEL_FALLBACKS.split(",") if m.strip()]

    @property
    def async_db_url(self) -> str:
        """Normalize to the asyncpg driver for the runtime engine.
        Strips any Prisma-style '?schema=' query the URL might carry."""
        url = self.DATABASE_URL.split("?", 1)[0]
        if url.startswith("postgresql+asyncpg://"):
            return url
        if url.startswith("postgresql://"):
            return "postgresql+asyncpg://" + url[len("postgresql://"):]
        if url.startswith("postgres://"):
            return "postgresql+asyncpg://" + url[len("postgres://"):]
        return url

    @property
    def sync_db_url(self) -> str:
        """psycopg2 form for one-off scripts / migrations."""
        url = self.DATABASE_URL.split("?", 1)[0]
        return url.replace("postgresql+asyncpg://", "postgresql://")


settings = Settings()
