"""query logs for analytics (latency, cited files, time-series)

Revision ID: 0004
Revises: 0003
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

UP = """
create table if not exists query_logs (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid references users(id) on delete cascade,
    collection_id uuid references collections(id) on delete set null,
    question      text,
    latency_ms    int,
    num_citations int not null default 0,
    cited_files   jsonb not null default '[]'::jsonb,
    created_at    timestamptz not null default now()
);
create index if not exists query_logs_created_idx on query_logs (created_at);
create index if not exists query_logs_collection_idx on query_logs (collection_id);
create index if not exists query_logs_user_idx on query_logs (user_id);
"""


def upgrade() -> None:
    op.execute(UP)


def downgrade() -> None:
    op.execute("drop table if exists query_logs;")
