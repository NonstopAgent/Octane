-- DB health snapshot for the Supabase health connector (service role only).

create or replace function public.octane_db_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'dbSizeBytes', pg_database_size(current_database()),
    'signalQueuePending', (
      select count(*) from public.signal_ingest_queue where consumed_at is null
    ),
    'signalQueueTotal', (select count(*) from public.signal_ingest_queue),
    'engineerQueued', (
      select count(*) from public.engineer_executions where status = 'queued'
    ),
    'engineerFailed', (
      select count(*) from public.engineer_executions where status = 'failed'
    ),
    'heartbeatCount24h', (
      select count(*) from public.project_heartbeats
      where checked_at > now() - interval '24 hours'
    ),
    'checkedAt', now()
  );
$$;

revoke execute on function public.octane_db_health() from public;
revoke execute on function public.octane_db_health() from anon;
revoke execute on function public.octane_db_health() from authenticated;
