export type AgentStatus =
  | "offline"
  | "idle"
  | "running"
  | "error"
  | "paused";

export interface Agent {
  id: string;
  name: string;
  purpose: string;
  status: AgentStatus;
  assignedProjectId?: string;
  capabilities: string[];
  lastRunAt?: string;
  currentTask?: string;
  successRate?: number;
  costEstimate?: number;
  safetyLimits?: string;
  humanApprovalRequired?: boolean;
  createdAt: string;
  updatedAt: string;
}
