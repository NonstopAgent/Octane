export type TaskAssignee = "Logan" | "AI Agent" | "Future Hire" | "Contractor";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type TaskStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "blocked"
  | "done";

export interface TaskSubtask {
  id: string;
  title: string;
  done: boolean;
}

/** Placeholder metadata until document linking ships */
export interface TaskLinkDocument {
  name: string;
  placeholderId?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assignedTo: TaskAssignee;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  tags: string[];
  difficulty?: "easy" | "medium" | "hard";
  notes?: string;
  subtasks?: TaskSubtask[];
  blockerReason?: string;
  linkedDocument?: TaskLinkDocument;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
