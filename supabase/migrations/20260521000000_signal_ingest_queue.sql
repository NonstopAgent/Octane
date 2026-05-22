-- Sentry (and future) webhook → client signal ingest bridge.
-- Apply via Supabase SQL editor or CLI. Requires SUPABASE_SERVICE_ROLE_KEY on the server
-- for webhook POST inserts and authenticated drain via API routes.

create table if not exists public.signal_ingest_queue (
  id text primary key,
  source text not null default 'sentry',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists signal_ingest_queue_pending_idx
  on public.signal_ingest_queue (source, created_at)
  where consumed_at is null;

alter table public.signal_ingest_queue enable row level security;

-- No public policies: server uses service role for insert/drain.
