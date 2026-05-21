export type OctaneActionType =
  | "add_project"
  | "create_task"
  | "create_coding_job"
  | "create_decision"
  | "create_github_issue"
  | "add_entity"
  | "connect_github"
  | "connect_vercel"
  | "add_note"
  | "add_reminder"
  | "link_project_resource";

export type OctaneActionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed";

export type OctaneActionSource =
  | "advisor"
  | "gmail"
  | "vercel"
  | "github"
  | "manual";

export type OctaneActionRiskLevel = "critical" | "high" | "medium" | "low";

/** Proposed change — requires explicit approval before execution. */
export interface OctaneAction {
  id: string;
  type: OctaneActionType;
  status: OctaneActionStatus;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  source: OctaneActionSource;
  riskLevel?: OctaneActionRiskLevel;
  projectId?: string;
  createdAt: string;
  resolvedAt?: string;
  errorMessage?: string;
}

const LEGACY_STATUS_MAP: Record<string, OctaneActionStatus> = {
  proposed: "pending",
  completed: "executed",
  failed: "executed",
};

const LEGACY_SOURCE_MAP: Record<string, OctaneActionSource> = {
  chat: "advisor",
  command_palette: "advisor",
  cron: "manual",
  setup: "manual",
};

export function normalizeOctaneActionStatus(
  value: unknown,
): OctaneActionStatus {
  const raw = typeof value === "string" ? value : "";
  if (raw in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[raw];
  if (
    raw === "pending" ||
    raw === "approved" ||
    raw === "rejected" ||
    raw === "executed"
  ) {
    return raw;
  }
  return "pending";
}

export function normalizeOctaneActionSource(
  value: unknown,
): OctaneActionSource {
  const raw = typeof value === "string" ? value : "";
  if (raw in LEGACY_SOURCE_MAP) return LEGACY_SOURCE_MAP[raw];
  if (
    raw === "advisor" ||
    raw === "gmail" ||
    raw === "vercel" ||
    raw === "github" ||
    raw === "manual"
  ) {
    return raw;
  }
  return "manual";
}

export function isPendingOctaneAction(action: OctaneAction): boolean {
  return action.status === "pending";
}

export function actionDedupeKey(action: Pick<OctaneAction, "source" | "title">): string {
  return `${action.source}:${action.title}`;
}
