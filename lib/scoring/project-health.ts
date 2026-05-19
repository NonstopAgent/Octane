import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";

import {
  getMonthlyExpenses,
  getMonthlyRevenue,
  isProjectStale,
} from "@/lib/dashboard/metrics";
import type { Decision, Project, Task, Transaction } from "@/lib/types";

export type ProjectHealthInput = {
  tasks: Task[];
  transactions: Transaction[];
  decisions: Decision[];
};

export interface ProjectHealth {
  score: number;
  blockersCount: number;
  openTasksCount: number;
  recentActivitySummary: string;
  nextRecommendedAction: string;
}

const PRIORITY_WEIGHT: Record<Task["priority"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function getLinkedTasks(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((t) => t.projectId === projectId);
}

function getHighestPriorityBlocked(tasks: Task[]): Task | undefined {
  return tasks
    .filter((t) => t.status === "blocked")
    .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])[0];
}

export function computeProjectHealth(
  project: Project,
  state: ProjectHealthInput,
  referenceDate: Date = new Date(),
): ProjectHealth {
  const today = startOfDay(referenceDate);
  const linked = getLinkedTasks(state.tasks, project.id);
  const blocked = linked.filter((t) => t.status === "blocked");
  const open = linked.filter((t) => t.status !== "done");
  const done = linked.filter((t) => t.status === "done");

  const projectTx = state.transactions.filter((t) => t.projectId === project.id);
  const monthlyRev = getMonthlyRevenue(projectTx, referenceDate);
  const monthlyExp = getMonthlyExpenses(projectTx, referenceDate);
  const hasDecision = state.decisions.some((d) => d.projectId === project.id);
  const stale = isProjectStale(project, today);
  const daysSinceUpdate = differenceInCalendarDays(
    today,
    startOfDay(parseISO(project.updatedAt)),
  );

  let score = 100;
  if (blocked.length > 0) score -= Math.min(30, blocked.length * 10);
  if (open.length > 0 && done.length === 0) score -= 10;
  if (stale) score -= 15;
  if (monthlyExp > 0 && monthlyRev === 0) score -= 15;
  if (!hasDecision && project.priority !== "low") score -= 5;
  if (project.status === "paused" || project.status === "killed") score -= 20;
  score = Math.max(0, Math.min(100, score));

  const recentParts: string[] = [];
  if (blocked.length > 0) {
    recentParts.push(`${blocked.length} blocked`);
  }
  if (open.length > 0) {
    recentParts.push(`${open.length} open tasks`);
  }
  recentParts.push(
    stale
      ? `stale ${daysSinceUpdate}d`
      : `updated ${daysSinceUpdate === 0 ? "today" : `${daysSinceUpdate}d ago`}`,
  );

  let nextRecommendedAction =
    "Continue highest-impact work on the current phase.";
  const topBlocked = getHighestPriorityBlocked(linked);
  if (blocked.length > 0 && topBlocked) {
    nextRecommendedAction = `Unblock highest-priority task: "${topBlocked.title}" (${topBlocked.priority}).`;
  } else if (stale) {
    nextRecommendedAction = `Run a status review — no updates in ${daysSinceUpdate}+ days.`;
  } else if (monthlyExp > 0 && monthlyRev === 0) {
    nextRecommendedAction =
      "Monetization risk: expenses without revenue — define a revenue path.";
  } else if (!hasDecision) {
    nextRecommendedAction =
      "Log a strategic decision record for this project.";
  }

  return {
    score,
    blockersCount: blocked.length,
    openTasksCount: open.length,
    recentActivitySummary: recentParts.join(" · "),
    nextRecommendedAction,
  };
}
