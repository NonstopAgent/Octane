import type { Signal } from "@/lib/types/signal";
import type { TaskPriority } from "@/lib/types/task";

/** Shape accepted by store.createTask (Omit<Task,"id"|"createdAt"|"updatedAt">). */
export interface SignalTaskDraft {
  title: string;
  description: string;
  projectId: string;
  assignedTo: "Logan";
  priority: TaskPriority;
  status: "ready";
  tags: string[];
}

function priorityFromSeverity(severity: Signal["severity"]): TaskPriority {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

/**
 * Turn a signal into a ready-to-work task draft. Title uses the signal's
 * recommended action (what to actually do); description keeps the context.
 */
export function taskDraftFromSignal(signal: Signal): SignalTaskDraft {
  const rawTitle = signal.recommendedAction?.trim() || `Handle: ${signal.title}`;
  const title =
    rawTitle.length > 120 ? `${rawTitle.slice(0, 117)}…` : rawTitle;
  const description = [
    signal.summary,
    signal.recommendedAction && signal.recommendedAction.trim() !== rawTitle
      ? `Recommended: ${signal.recommendedAction.trim()}`
      : "",
    `Source: ${signal.source} signal — "${signal.title}"`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title,
    description,
    projectId: signal.projectId ?? "",
    assignedTo: "Logan",
    priority: priorityFromSeverity(signal.severity),
    status: "ready",
    tags: ["from-signal", signal.source],
  };
}
