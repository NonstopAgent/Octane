import { getSupabaseServiceClient } from "@/lib/supabase/service-client";
import type {
  ConnectedProjectRow,
  CreateExecutionOptions,
  EngineerExecutionCloseStatus,
} from "@/lib/types/engineer-execution";

function requireServiceDb() {
  const client = getSupabaseServiceClient();
  if (!client) {
    throw new Error(
      "Supabase service role not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return client;
}

export class OctaneEngineerCore {
  /** Resolve project by name, enqueue execution, return UUID. */
  static async createExecution({
    projectName,
    commandType,
    payload = {},
  }: CreateExecutionOptions): Promise<string> {
    const supabase = requireServiceDb();

    const { data: project, error: projectError } = await supabase
      .from("connected_projects")
      .select("id")
      .eq("name", projectName)
      .single<Pick<ConnectedProjectRow, "id">>();

    if (projectError || !project) {
      throw new Error(
        `Failed to resolve project: ${projectName}. Ensure it exists in connected_projects.`,
      );
    }

    const { data, error } = await supabase
      .from("engineer_executions")
      .insert({
        project_id: project.id,
        command_type: commandType,
        payload,
        status: "queued",
      })
      .select("id")
      .single<{ id: string }>();

    if (error) throw error;
    if (!data?.id) {
      throw new Error("Failed to create engineer execution (no id returned).");
    }

    return data.id;
  }

  /** Mark execution as processing and record start time. */
  static async startExecution(executionId: string): Promise<void> {
    const supabase = requireServiceDb();

    const { error } = await supabase
      .from("engineer_executions")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    if (error) {
      console.error(
        `[Octane Engineer] Failed to start execution ${executionId}:`,
        error,
      );
    }
  }

  /** Finalize execution with status, logs, and completion time. */
  static async closeExecution(
    executionId: string,
    status: EngineerExecutionCloseStatus,
    logs: string,
  ): Promise<void> {
    const supabase = requireServiceDb();

    const { error } = await supabase
      .from("engineer_executions")
      .update({
        status,
        logs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    if (error) {
      console.error(
        `[Octane Engineer] Failed to close execution ${executionId}:`,
        error,
      );
    }
  }
}
