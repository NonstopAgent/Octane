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
  steps: CodingJobPlanStep[];
  files: string[];
  risks: string[];
  testPlan: string[];
}

export type CodingJobFileAction = "add" | "modify" | "delete";

export interface CodingJobChangedFile {
  path: string;
  action: CodingJobFileAction;
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
