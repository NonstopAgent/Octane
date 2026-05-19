import {
  differenceInCalendarDays,
  isSameDay,
  parseISO,
  startOfDay,
} from "date-fns";

import { generateMorningBriefing } from "@/lib/briefing/generate-briefing";
import type { BriefingDecisionRef, BriefingTaskRef } from "@/lib/briefing/generate-briefing";
import { isOpenTaskStatus } from "@/lib/dashboard/metrics";
import type { OctanePersistedState } from "@/lib/store/octane-store";
import type { Project, Task, TaskPriority } from "@/lib/types";

export type TodayTaskRef = {
  task: Task;
  projectName: string;
};

export type TodayViewData = {
  generatedAt: string;
  topThreeMoves: string[];
  dueToday: TodayTaskRef[];
  overdue: BriefingTaskRef[];
  blocked: TodayTaskRef[];
  highPriorityOpen: TodayTaskRef[];
  decisionsNeedingReview: BriefingDecisionRef[];
  projectsNeedingAttention: ReturnType<
    typeof generateMorningBriefing
  >["staleProjects"];
  moneyAlerts: string[];
  suggestedFocusOrder: string[];
};

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 40,
  high: 30,
  medium: 15,
  low: 5,
};

function projectNameById(projects: Project[], projectId: string): string {
  return projects.find((p) => p.id === projectId)?.name ?? "Unknown project";
}

function toTaskRef(task: Task, projects: Project[]): TodayTaskRef {
  return {
    task,
    projectName: projectNameById(projects, task.projectId),
  };
}

function selectDueTodayTasks(
  tasks: Task[],
  projects: Project[],
  today: Date,
): TodayTaskRef[] {
  return tasks
    .filter((task) => {
      if (task.status === "done" || !task.dueDate) return false;
      return isSameDay(startOfDay(parseISO(task.dueDate)), today);
    })
    .map((task) => toTaskRef(task, projects))
    .sort((a, b) => {
      const pw =
        PRIORITY_WEIGHT[b.task.priority] - PRIORITY_WEIGHT[a.task.priority];
      if (pw !== 0) return pw;
      return a.task.title.localeCompare(b.task.title);
    });
}

function selectBlockedTasks(tasks: Task[], projects: Project[]): TodayTaskRef[] {
  return tasks
    .filter((t) => t.status === "blocked")
    .map((task) => toTaskRef(task, projects))
    .sort(
      (a, b) =>
        PRIORITY_WEIGHT[b.task.priority] - PRIORITY_WEIGHT[a.task.priority],
    );
}

function selectHighPriorityOpen(
  tasks: Task[],
  projects: Project[],
): TodayTaskRef[] {
  return tasks
    .filter(
      (t) =>
        isOpenTaskStatus(t.status) &&
        (t.priority === "critical" || t.priority === "high"),
    )
    .map((task) => toTaskRef(task, projects))
    .sort((a, b) => {
      const statusOrder: Record<Task["status"], number> = {
        in_progress: 0,
        ready: 1,
        blocked: 2,
        backlog: 3,
        done: 4,
      };
      const so = statusOrder[a.task.status] - statusOrder[b.task.status];
      if (so !== 0) return so;
      return (
        PRIORITY_WEIGHT[b.task.priority] - PRIORITY_WEIGHT[a.task.priority]
      );
    });
}

function scoreTaskForFocus(
  task: Task,
  today: Date,
  overdueIds: Set<string>,
): number {
  let score = PRIORITY_WEIGHT[task.priority];
  if (task.status === "blocked") score += 80;
  if (task.status === "in_progress") score += 20;
  if (task.dueDate) {
    const due = startOfDay(parseISO(task.dueDate));
    if (isSameDay(due, today)) score += 60;
    if (overdueIds.has(task.id)) {
      score +=
        100 +
        differenceInCalendarDays(today, due);
    }
  }
  return score;
}

function buildSuggestedFocusOrder(
  tasks: Task[],
  projects: Project[],
  today: Date,
  overdue: BriefingTaskRef[],
): string[] {
  const overdueIds = new Set(overdue.map((o) => o.task.id));
  const ranked = tasks
    .filter((t) => isOpenTaskStatus(t.status))
    .map((task) => ({
      task,
      score: scoreTaskForFocus(task, today, overdueIds),
      projectName: projectNameById(projects, task.projectId),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (ranked.length === 0) {
    return ["No open tasks — capture the next move in a work session."];
  }

  return ranked.map(
    ({ task, projectName }, index) =>
      `${index + 1}. ${task.title} (${projectName}) · ${task.priority} · ${task.status.replace("_", " ")}`,
  );
}

export function generateTodayView(
  state: OctanePersistedState,
  referenceDate: Date = new Date(),
): TodayViewData {
  const today = startOfDay(referenceDate);
  const briefing = generateMorningBriefing(state, referenceDate);

  const dueToday = selectDueTodayTasks(state.tasks, state.projects, today);
  const blocked = selectBlockedTasks(state.tasks, state.projects);
  const highPriorityOpen = selectHighPriorityOpen(state.tasks, state.projects);

  const topThreeMoves = briefing.topPriorities.slice(0, 3);
  if (topThreeMoves.length === 0) {
    topThreeMoves.push(
      "Operations look stable — pick one high-impact task and start a work session.",
    );
  }

  const suggestedFocusOrder = buildSuggestedFocusOrder(
    state.tasks,
    state.projects,
    today,
    briefing.overdueTasks,
  );

  return {
    generatedAt: briefing.generatedAt,
    topThreeMoves,
    dueToday,
    overdue: briefing.overdueTasks,
    blocked,
    highPriorityOpen,
    decisionsNeedingReview: briefing.decisionsDue,
    projectsNeedingAttention: briefing.staleProjects,
    moneyAlerts: briefing.financialAlerts,
    suggestedFocusOrder,
  };
}
