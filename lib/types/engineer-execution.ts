export interface CreateExecutionOptions {
  projectName: string;
  commandType: string;
  payload?: Record<string, unknown>;
}

export type EngineerExecutionCloseStatus = "completed" | "failed";

export type EngineerExecutionStatus =
  | "queued"
  | "processing"
  | EngineerExecutionCloseStatus;

export interface ConnectedProjectRow {
  id: string;
  name: string;
}

export interface EngineerExecutionRow {
  id: string;
  project_id: string;
  command_type: string;
  payload: Record<string, unknown>;
  status: EngineerExecutionStatus;
  logs: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

/** Row shape returned by Supabase when joining connected_projects. */
export type EngineerExecutionHistoryJoin =
  | Pick<ConnectedProjectRow, "name">
  | Pick<ConnectedProjectRow, "name">[];

export interface EngineerExecutionHistoryRow extends EngineerExecutionRow {
  connected_projects: EngineerExecutionHistoryJoin | null;
}

/** API / dashboard view of a single execution. */
export interface EngineerExecutionHistoryItem {
  id: string;
  project_id: string;
  project_name: string | null;
  command_type: string;
  payload: Record<string, unknown>;
  status: EngineerExecutionStatus;
  logs: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface EngineerExecutionStatusCounts {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface EngineerExecutionDashboardSummary {
  counts: EngineerExecutionStatusCounts;
  lastRun: EngineerExecutionHistoryItem | null;
}

export interface InternalTypecheckResult {
  executionId: string;
  success: boolean;
  output: string;
}

export interface ExecutionDashboardProps {
  /** When omitted, the dashboard fetches from `/api/engineer/history`. */
  initialExecutions?: EngineerExecutionHistoryItem[];
}
