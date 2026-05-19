export type WorkSessionStatus = "active" | "completed" | "abandoned";

export interface WorkSession {
  id: string;
  title: string;
  projectId?: string;
  taskId?: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  status: WorkSessionStatus;
  notes?: string;
  outcome?: string;
  createdAt: string;
  updatedAt: string;
}
