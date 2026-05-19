export type ProjectStatus =
  | "idea"
  | "building"
  | "testing"
  | "launched"
  | "paused"
  | "killed";

export type ProjectPriority = "low" | "medium" | "high" | "critical";

export type ProjectRevenueStatus =
  | "none"
  | "pre_revenue"
  | "early_revenue"
  | "recurring"
  | "profitable";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  owner: string;
  progress: number;
  revenueStatus: ProjectRevenueStatus;
  goals?: string[];
  currentPhase?: string;
  risks?: string[];
  nextActions?: string[];
  revenueNotes?: string;
  createdAt: string;
  updatedAt: string;
}
