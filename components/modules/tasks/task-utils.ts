import { format } from "date-fns";

import type {
  TaskAssignee,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";

export const KANBAN_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "ready", label: "Ready" },
  { id: "in_progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
  { id: "done", label: "Done" },
];

export const TASK_STATUSES: TaskStatus[] = KANBAN_COLUMNS.map((c) => c.id);

export const TASK_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const TASK_ASSIGNEES: TaskAssignee[] = [
  "Logan",
  "AI Agent",
  "Future Hire",
  "Contractor",
];

export const TASK_DIFFICULTIES = ["easy", "medium", "hard"] as const;

export function formatDueDate(iso?: string): string {
  if (!iso) return "No due date";
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

export function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}
