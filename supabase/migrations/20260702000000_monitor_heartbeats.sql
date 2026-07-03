-- Uptime monitoring: targets + heartbeat history.
-- Server-only via SUPABASE_SERVICE_ROLE_KEY (no public policies).

create table if not exists public.monitor_targets (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  url text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.project_heartbeats (
  id bigint generated always as identity primary key,
  target_id uuid not null references public.monitor_targets (id) on delete cascade,
  ok boolean not null,
  status_code integer,
  latency_ms integer,
  error text,
  checked_at timestamptz not null default now()
);

create index if not exists project_heartbeats_target_time_idx
  on public.project_heartbeats (target_id, checked_at desc);

alter table public.monitor_targets enable row level security;
alter table public.project_heartbeats enable row level security;

-- Seed the three Octane production apps (stable Vercel aliases).
insert into public.monitor_targets (project_name, url) values
  ('octane-nexus-6em9', 'https://octane-nexus-6em9.vercel.app'),
  ('octane-ajax', 'https://octane-ajax-nonstopagents-projects.vercel.app'),
  ('octane', 'https://octane-nonstopagents-projects.vercel.app')
on conflict (url) do nothing;
