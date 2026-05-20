import type { CodingJobLog } from "@/lib/types/coding-job-log";

export type CodingJobStatus =
  | "draft"
  | "planning"
  | "pending_approval"
  | "approved"
  | "running"
  | "pr_open"
  | "completed"
  | "failed"
  | "cancelled";

/** Review = human approves every PR. Assisted = plan + PR with approval gate. Autopilot disabled in UI. */
export type CodingJobMode = "review" | "assisted" | "autopilot";

export type CodingJobPlanStepStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "skipped";

export interface CodingJobPlanStep {
  id: string;
  order: number;
  title: string;
  description?: string;
  status: CodingJobPlanStepStatus;
}

export interface CodingJobPlan {
  summary: string;
  /** Plain-language restatement of the founder request. */
  understoodRequest?: string;
  steps: CodingJobPlanStep[];
  files: string[];
  risks: string[];
  testPlan: string[];
  /** Human review checklist before merge. */
  reviewItems?: string[];
  /** Explicit safety boundaries (no merge, deploy, etc.). */
  wontAutoHappen?: string[];
}

export type CodingJobFileAction = "add" | "modify" | "delete";

export interface CodingJobChangedFile {
  path: string;
  action: CodingJobFileAction;
}

/** Planning doc PR vs real source-edit PR workflow. */
export type CodingJobEditMode = "planning_pr" | "source_pr";

export type CodingJobPrKind = "planning" | "source";

export type CodingJobEditApprovalStatus =
  | "pending"
  | "approved"
  | "rejected";

/** AI-proposed source change (preview + full after content for apply). */
export interface CodingJobProposedEdit {
  path: string;
  beforePreview: string;
  afterPreview: string;
  summary: string;
  /** Full file content after edit — used when opening source PR. */
  afterContent: string;
}

/** GitHub coding workbench job — local state with server-side PR execution. */
export interface CodingJob {
  id: string;
  title: string;
  prompt: string;
  projectId?: string;
  repo: string;
  mode: CodingJobMode;
  status: CodingJobStatus;
  plan?: CodingJobPlan;
  changedFiles: CodingJobChangedFile[];
  logs: CodingJobLog[];
  /** Workflow: planning doc only vs source edits + PR. */
  editMode?: CodingJobEditMode;
  /** Paths discovered or selected for source edit generation. */
  proposedFiles?: string[];
  /** @deprecated Use proposedEdits — kept for backward-compatible imports. */
  filePatches?: CodingJobProposedEdit[];
  proposedEdits?: CodingJobProposedEdit[];
  editApprovalStatus?: CodingJobEditApprovalStatus;
  /** Kind of PR opened on GitHub (if any). */
  prKind?: CodingJobPrKind;
  branchName?: string;
  baseBranch?: string;
  prNumber?: number;
  prUrl?: string;
  approvedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
