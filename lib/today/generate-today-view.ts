import {
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
  dueToday: TodayTaskRef[];
  overdue: BriefingTaskRef[];
  blocked: TodayTaskRef[];
  highPriorityOpen: TodayTaskRef[];
  decisionsNeedingReview: BriefingDecisionRef[];
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

export function generateTodayView(
  state: OctanePersistedState,
  referenceDate: Date = new Date(),
): TodayViewData {
  const today = startOfDay(referenceDate);
  const briefing = generateMorningBriefing(state, referenceDate);

  return {
    generatedAt: briefing.generatedAt,
    dueToday: selectDueTodayTasks(state.tasks, state.projects, today),
    overdue: briefing.overdueTasks,
    blocked: selectBlockedTasks(state.tasks, state.projects),
    highPriorityOpen: selectHighPriorityOpen(state.tasks, state.projects),
    decisionsNeedingReview: briefing.decisionsDue,
  };
}
