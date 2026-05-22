-- Octane Engineer execution queue (Core dispatches to Nexus/Ajax spokes).
-- Apply via Supabase SQL editor or CLI. Requires SUPABASE_SERVICE_ROLE_KEY on the server.

create table if not exists public.connected_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.engineer_executions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.connected_projects (id) on delete cascade,
  command_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  logs text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists engineer_executions_project_status_idx
  on public.engineer_executions (project_id, status, created_at desc);

alter table public.connected_projects enable row level security;
alter table public.engineer_executions enable row level security;

-- No public policies: server uses service role for queue CRUD.
