import type {
  AgentStatus,
  DecisionStatus,
  DocumentStatus,
  ProjectStatus,
  TaskStatus,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  badgeToneClass,
  formatStatusLabel,
  type BadgeTone,
} from "./badge-tones";

export type StatusDomain =
  | "project"
  | "task"
  | "agent"
  | "document"
  | "decision";

export type StatusBadgeProps = {
  className?: string;
} & (
  | { domain: "project"; status: ProjectStatus }
  | { domain: "task"; status: TaskStatus }
  | { domain: "agent"; status: AgentStatus }
  | { domain: "document"; status: DocumentStatus }
  | { domain: "decision"; status: DecisionStatus }
);

const projectStatusTone: Record<ProjectStatus, BadgeTone> = {
  idea: "neutral",
  building: "info",
  testing: "warning",
  launched: "success",
  paused: "neutral",
  killed: "danger",
};

const taskStatusTone: Record<TaskStatus, BadgeTone> = {
  backlog: "neutral",
  ready: "info",
  in_progress: "info",
  blocked: "warning",
  done: "success",
};

const agentStatusTone: Record<AgentStatus, BadgeTone> = {
  offline: "neutral",
  idle: "neutral",
  running: "success",
  error: "danger",
  paused: "warning",
};

const documentStatusTone: Record<DocumentStatus, BadgeTone> = {
  draft: "neutral",
  active: "success",
  archived: "neutral",
  needs_review: "warning",
};

const decisionStatusTone: Record<DecisionStatus, BadgeTone> = {
  active: "success",
  reversed: "danger",
  under_review: "warning",
  completed: "info",
};

function resolveTone(
  domain: StatusDomain,
  status: StatusBadgeProps["status"],
): BadgeTone {
  switch (domain) {
    case "project":
      return projectStatusTone[status as ProjectStatus];
    case "task":
      return taskStatusTone[status as TaskStatus];
    case "agent":
      return agentStatusTone[status as AgentStatus];
    case "document":
      return documentStatusTone[status as DocumentStatus];
    case "decision":
      return decisionStatusTone[status as DecisionStatus];
  }
}

export function StatusBadge({ domain, status, className }: StatusBadgeProps) {
  const tone = resolveTone(domain, status);

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border font-medium",
        badgeToneClass[tone],
        className,
      )}
    >
      {formatStatusLabel(status)}
    </Badge>
  );
}
