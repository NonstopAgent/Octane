export type OctaneActionType =
  | "add_project"
  | "create_task"
  | "create_coding_job"
  | "create_decision"
  | "add_entity"
  | "connect_github"
  | "connect_vercel"
  | "add_note"
  | "add_reminder"
  | "link_project_resource";

export type OctaneActionStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "completed"
  | "failed";

export type OctaneActionSource = "chat" | "command_palette" | "manual" | "setup";

/** Proposed change — requires explicit approval before execution. */
export interface OctaneAction {
  id: string;
  type: OctaneActionType;
  status: OctaneActionStatus;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  source: OctaneActionSource;
  projectId?: string;
  proposedAt: string;
  resolvedAt?: string;
  errorMessage?: string;
}
