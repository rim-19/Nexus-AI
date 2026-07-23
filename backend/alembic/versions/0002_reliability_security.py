"""reliability + security: job queue, refresh tokens, email tokens, storage_path, email_verified

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

UPGRADE = """
alter table users add column if not exists email_verified boolean not null default false;
alter table documents add column if not exists storage_path text;

create table if not exists refresh_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    jti text unique not null,
    expires_at timestamptz not null,
    revoked boolean not null default false,
    created_at timestamptz not null default now()
);
create index if not exists refresh_tokens_user_idx on refresh_tokens (user_id);

create table if not exists ingestion_jobs (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references documents(id) on delete cascade,
    upload_path text,
    status text not null default 'queued',   -- queued | running | done | failed
    attempts int not null default 0,
    error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists ingestion_jobs_status_idx on ingestion_jobs (status, created_at);

create table if not exists email_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    kind text not null,                       -- verify | reset
    token text unique not null,
    expires_at timestamptz not null,
    used boolean not null default false,
    created_at timestamptz not null default now()
);
"""

DOWNGRADE = """
drop table if exists email_tokens;
drop table if exists ingestion_jobs;
drop table if exists refresh_tokens;
alter table documents drop column if exists storage_path;
alter table users drop column if exists email_verified;
"""


def upgrade() -> None:
    op.execute(UPGRADE)


def downgrade() -> None:
    op.execute(DOWNGRADE)
