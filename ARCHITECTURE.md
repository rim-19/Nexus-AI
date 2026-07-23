# Architecture

A closer look at how Nexus AI is put together.

## System overview

```mermaid
flowchart TB
    subgraph FE["Frontend — Next.js"]
        Pages["Landing · Auth · Dashboard · Collection · Analytics"]
        Client["Typed API client (fetch, cookies)"]
    end

    subgraph BE["Backend — FastAPI"]
        MW["CORS · rate limiter · session middleware"]
        Auth["Auth (cookies + refresh rotation)"]
        Routes["Workspaces · Documents · Chat · Search · Stats · Eval"]
        Orch["RAG orchestrator"]
        Prov["Providers (LLM · Embeddings · Reranker)"]
        Queue["Ingestion worker (asyncio)"]
    end

    subgraph SB["Supabase"]
        PG[("Postgres")]
        VEC[("pgvector")]
        FTS[("full-text search")]
    end

    subgraph EXT["External AI"]
        Groq["Groq"]
        Gem["Gemini"]
        Jina["Jina (embed + rerank)"]
    end

    Pages --> Client --> MW --> Auth
    Client --> Routes
    Routes --> Orch --> Prov
    Prov --> Groq & Gem & Jina
    Routes --> PG
    Orch --> VEC & FTS
    Queue --> PG & VEC
    Queue --> Jina
    Auth --> PG
```

## Ingestion

A source (repo or file) becomes searchable through a durable, retrying pipeline.

```mermaid
flowchart TD
    Add["POST /documents (repo URL or file)"] --> Save["Persist file to storage"]
    Save --> Enq["Enqueue job in ingestion_jobs"]
    Enq --> Claim["Worker claims job<br/>(FOR UPDATE SKIP LOCKED)"]
    Claim --> Load["Load source"]

    Load --> Code{"Code file?"}
    Code -- yes --> TS["tree-sitter split<br/>by function / class<br/>(keeps file:line + symbol)"]
    Code -- no --> Prose["Token-window split<br/>(keeps page number)"]

    TS --> Embed["Batch embed (Jina)"]
    Prose --> Embed
    Embed --> Store["Store vectors + metadata in Postgres"]
    Store --> Done["status = ready"]
    Claim -. "on failure, retry up to N" .-> Enq
```

Key points:
- **Structure-aware chunking** is what makes citations meaningful — a chunk is a
  whole function or class with its real line range, not an arbitrary slice.
- Jobs live in Postgres, so a restart mid-index doesn't lose work; the worker
  just picks them back up and retries.
- Files are persisted through a storage interface (local disk today, swappable
  for S3 / Supabase Storage).

## Retrieval and answering

```mermaid
sequenceDiagram
    participant U as User
    participant API as Chat endpoint
    participant HS as Hybrid search
    participant RR as Reranker
    participant LLM as LLM

    U->>API: question (+ scope)
    API->>HS: embed query, search
    HS->>HS: vector (pgvector) + keyword (FTS)
    HS->>HS: Reciprocal Rank Fusion → top 20
    HS->>RR: candidates
    RR-->>API: top 5
    API->>API: build grounded prompt (cite or refuse)
    API->>LLM: stream
    LLM-->>U: tokens…
    API-->>U: final citations (file:line / page)
```

The prompt tells the model to answer only from the provided context, cite each
claim, and explicitly refuse when the answer isn't there — which is why an
off-topic question returns "I don't have enough information" instead of a
hallucination.

## Auth

Sessions are cookie-based, not token-in-localStorage.

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as Auth API
    participant DB as Postgres

    B->>A: login (email, password)
    A->>DB: verify, store refresh jti
    A-->>B: Set-Cookie nx_access (15m) + nx_refresh (7d, httpOnly)
    B->>A: request (cookie sent automatically)
    Note over B,A: on 401, client calls /refresh once
    B->>A: refresh (nx_refresh cookie)
    A->>DB: check jti valid, revoke old, issue new (rotation)
    A-->>B: new cookies
```

- Access and refresh tokens are **httpOnly** — JavaScript never sees them.
- Refresh tokens are **single-use**; reusing a rotated token is rejected.
- Auth endpoints are rate-limited; CORS is locked to the frontend origin.

## Data model (core tables)

```mermaid
erDiagram
    users ||--o{ workspaces : owns
    workspaces ||--o{ collections : contains
    collections ||--o{ documents : holds
    documents ||--o{ chunks : "split into"
    collections ||--o{ conversations : has
    conversations ||--o{ messages : contains
    collections ||--o{ eval_sets : has
    documents ||--o{ ingestion_jobs : queued
    users ||--o{ refresh_tokens : rotates
```

`chunks` carries the vector (`vector(1024)`), a generated `tsvector` for keyword
search, and JSON metadata (file path, line range, page, symbol name) that powers
citations and the knowledge map.
