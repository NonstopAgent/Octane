import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import type {
  EngineerExecutionHistoryItem,
  EngineerExecutionHistoryRow,
} from "@/lib/types/engineer-execution";

export interface EngineerHistoryFilters {
  status?: string;
  command_type?: string;
  project?: string;
}

function resolveProjectName(
  join: EngineerExecutionHistoryRow["connected_projects"],
): string | null {
  if (!join) return null;
  if (Array.isArray(join)) return join[0]?.name ?? null;
  return join.name;
}

function mapHistoryRow(row: EngineerExecutionHistoryRow): EngineerExecutionHistoryItem {
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: resolveProjectName(row.connected_projects),
    command_type: row.command_type,
    payload: row.payload,
    status: row.status,
    logs: row.logs,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
  };
}

/** Fetch latest engineer executions with optional filters (max 50). */
export async function fetchEngineerExecutionHistory(
  filters: EngineerHistoryFilters = {},
): Promise<EngineerExecutionHistoryItem[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error(
      "Supabase service role not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const projectFilter = filters.project?.trim();
  const projectJoin = projectFilter
    ? "connected_projects!inner ( name )"
    : "connected_projects ( name )";

  let query = supabase
    .from("engineer_executions")
    .select(
      `
      id,
      project_id,
      command_type,
      payload,
      status,
      logs,
      started_at,
      completed_at,
      created_at,
      ${projectJoin}
    `,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (projectFilter) {
    query = query.eq("connected_projects.name", projectFilter);
  }

  if (filters.status?.trim()) {
    query = query.eq("status", filters.status.trim());
  }

  if (filters.command_type?.trim()) {
    query = query.eq("command_type", filters.command_type.trim());
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data ?? []) as unknown as EngineerExecutionHistoryRow[];
  return rows.map(mapHistoryRow);
}
