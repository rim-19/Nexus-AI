-- KnowledgeHub AI — full schema for Supabase (Postgres + pgvector).
-- Run once in Supabase → SQL Editor (or pgAdmin connected to Supabase).
-- Embedding dimension is 1024 (Jina jina-embeddings-v3). If you change the
-- embedding provider to a different dimension, change vector(1024) below and re-index.

create extension if not exists vector;

-- ---------- users & tenancy ----------
create table if not exists users (
    id            uuid primary key default gen_random_uuid(),
    email         text unique not null,
    password_hash text not null,
    name          text,
    created_at    timestamptz not null default now()
);

create table if not exists workspaces (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    owner_user_id uuid not null references users(id) on delete cascade,
    type          text not null default 'individual',   -- individual | org
    created_at    timestamptz not null default now()
);

create table if not exists workspace_members (
    workspace_id uuid not null references workspaces(id) on delete cascade,
    user_id      uuid not null references users(id) on delete cascade,
    role         text not null default 'member',        -- owner | member (extensible)
    primary key (workspace_id, user_id)
);

create table if not exists collections (
    id           uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    name         text not null,
    created_at   timestamptz not null default now()
);

-- ---------- documents & chunks ----------
create table if not exists documents (
    id            uuid primary key default gen_random_uuid(),
    collection_id uuid not null references collections(id) on delete cascade,
    source_type   text not null,                         -- github | pdf | docx | md | txt
    source_ref    text not null,                         -- url or filename
    status        text not null default 'pending',       -- pending | indexing | ready | failed
    error         text,
    num_chunks    int  not null default 0,
    created_at    timestamptz not null default now()
);

create table if not exists chunks (
    id            uuid primary key default gen_random_uuid(),
    document_id   uuid not null references documents(id) on delete cascade,
    collection_id uuid not null references collections(id) on delete cascade,
    ordinal       int  not null,
    content       text not null,
    token_count   int  not null default 0,
    -- metadata: file_path, start_line, end_line, page, symbol_name, language
    metadata      jsonb not null default '{}'::jsonb,
    embedding     vector(1024),
    -- generated column for keyword (BM25-style) half of hybrid search
    tsv           tsvector generated always as (to_tsvector('english', content)) stored,
    created_at    timestamptz not null default now()
);

-- vector index (cosine) for dense search
create index if not exists chunks_embedding_idx
    on chunks using hnsw (embedding vector_cosine_ops);
-- full-text index for keyword search
create index if not exists chunks_tsv_idx on chunks using gin (tsv);
create index if not exists chunks_collection_idx on chunks (collection_id);
create index if not exists chunks_document_idx on chunks (document_id);

-- ---------- chat ----------
create table if not exists conversations (
    id            uuid primary key default gen_random_uuid(),
    collection_id uuid not null references collections(id) on delete cascade,
    user_id       uuid not null references users(id) on delete cascade,
    scope         jsonb not null default '{}'::jsonb,    -- {type: workspace|collection|document, id}
    created_at    timestamptz not null default now()
);

create table if not exists messages (
    id              uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations(id) on delete cascade,
    role            text not null,                        -- user | assistant
    content         text not null,
    citations       jsonb not null default '[]'::jsonb,
    created_at      timestamptz not null default now()
);

-- ---------- evaluation ----------
create table if not exists eval_sets (
    id            uuid primary key default gen_random_uuid(),
    collection_id uuid not null references collections(id) on delete cascade,
    name          text not null,
    created_at    timestamptz not null default now()
);

create table if not exists eval_items (
    id              uuid primary key default gen_random_uuid(),
    eval_set_id     uuid not null references eval_sets(id) on delete cascade,
    question        text not null,
    expected_answer text,
    gold_source     text                                  -- file_path / filename we expect retrieved
);
