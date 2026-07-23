"""baseline schema (mirrors schema.sql; IF NOT EXISTS so it no-ops on existing DBs)

Revision ID: 0001
Revises:
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

BASELINE = """
create extension if not exists vector;

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    password_hash text not null,
    name text,
    created_at timestamptz not null default now()
);
create table if not exists workspaces (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    owner_user_id uuid not null references users(id) on delete cascade,
    type text not null default 'individual',
    created_at timestamptz not null default now()
);
create table if not exists workspace_members (
    workspace_id uuid not null references workspaces(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    role text not null default 'member',
    primary key (workspace_id, user_id)
);
create table if not exists collections (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references workspaces(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now()
);
create table if not exists documents (
    id uuid primary key default gen_random_uuid(),
    collection_id uuid not null references collections(id) on delete cascade,
    source_type text not null,
    source_ref text not null,
    status text not null default 'pending',
    error text,
    num_chunks int not null default 0,
    created_at timestamptz not null default now()
);
create table if not exists chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references documents(id) on delete cascade,
    collection_id uuid not null references collections(id) on delete cascade,
    ordinal int not null,
    content text not null,
    token_count int not null default 0,
    metadata jsonb not null default '{}'::jsonb,
    embedding vector(1024),
    tsv tsvector generated always as (to_tsvector('english', content)) stored,
    created_at timestamptz not null default now()
);
create index if not exists chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index if not exists chunks_tsv_idx on chunks using gin (tsv);
create index if not exists chunks_collection_idx on chunks (collection_id);
create index if not exists chunks_document_idx on chunks (document_id);
create table if not exists conversations (
    id uuid primary key default gen_random_uuid(),
    collection_id uuid not null references collections(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    scope jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create table if not exists messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations(id) on delete cascade,
    role text not null,
    content text not null,
    citations jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now()
);
create table if not exists eval_sets (
    id uuid primary key default gen_random_uuid(),
    collection_id uuid not null references collections(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now()
);
create table if not exists eval_items (
    id uuid primary key default gen_random_uuid(),
    eval_set_id uuid not null references eval_sets(id) on delete cascade,
    question text not null,
    expected_answer text,
    gold_source text
);
"""


def upgrade() -> None:
    op.execute(BASELINE)


def downgrade() -> None:
    pass  # baseline — no downgrade
