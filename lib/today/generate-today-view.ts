import {
  differenceInCalendarDays,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";

import { safeParseISO } from "@/lib/dates/safe-parse";
import { isOpenTaskStatus } from "@/lib/dashboard/metrics";
import type { OctanePersistedState } from "@/lib/store/octane-store";
import type { Project, Task, TaskPriority } from "@/lib/types";

export type TodayTaskRef = {
  task: Task;
  projectName: string;
};

export type TodayOverdueTaskRef = TodayTaskRef & {
  daysOverdue: number;
};

export type TodayBlockedProjectRef = {
  project: Project;
  blockedCount: number;
};

export type TodayViewData = {
  generatedAt: string;
  dueToday: TodayTaskRef[];
  overdue: TodayOverdueTaskRef[];
  blocked: TodayTaskRef[];
  blockedProjects: TodayBlockedProjectRef[];
  highPriorityOpen: TodayTaskRef[];
};

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 40,
  high: 30,
  medium: 15,
  low: 5,
};

function projectNameById(projects: Project[], projectId: string | undefined): string {
  if (!projectId) return "";
  return projects.find((p) => p.id === projectId)?.name ?? "";
}

function toTaskRef(task: Task, projects: Project[]): TodayTaskRef {
  return {
    task,
    projectName: projectNameById(projects, task.projectId) || "Unassigned",
  };
}

function selectDueTodayTasks(
  tasks: Task[],
  projects: Project[],
  today: Date,
): TodayTaskRef[] {
  return (tasks ?? [])
    .filter((task) => {
      if (task.status === "done" || !task.dueDate) return false;
      const due = safeParseISO(task.dueDate);
      if (!due) return false;
      return isSameDay(startOfDay(due), today);
    })
    .map((task) => toTaskRef(task, projects))
    .sort((a, b) => {
      const pw =
        PRIORITY_WEIGHT[b.task.priority] - PRIORITY_WEIGHT[a.task.priority];
      if (pw !== 0) return pw;
      return a.task.title.localeCompare(b.task.title);
    });
}

function selectOverdueTasks(
  tasks: Task[],
  projects: Project[],
  today: Date,
): TodayOverdueTaskRef[] {
  return (tasks ?? [])
    .filter((task) => {
      if (task.status === "done" || !task.dueDate) return false;
      const due = safeParseISO(task.dueDate);
      if (!due) return false;
      return isBefore(startOfDay(due), today);
    })
    .map((task) => {
      const due = safeParseISO(task.dueDate!)!;
      return {
        ...toTaskRef(task, projects),
        daysOverdue: differenceInCalendarDays(today, startOfDay(due)),
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

function selectBlockedTasks(tasks: Task[], projects: Project[]): TodayTaskRef[] {
  return (tasks ?? [])
    .filter((t) => t.status === "blocked")
    .map((task) => toTaskRef(task, projects))
    .sort(
      (a, b) =>
        PRIORITY_WEIGHT[b.task.priority] - PRIORITY_WEIGHT[a.task.priority],
    );
}

function selectBlockedProjects(
  tasks: Task[],
  projects: Project[],
): TodayBlockedProjectRef[] {
  const counts = new Map<string, number>();
  for (const task of tasks ?? []) {
    if (task.status !== "blocked" || !task.projectId) continue;
    counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([projectId, blockedCount]) => {
      const project = (projects ?? []).find((p) => p.id === projectId);
      if (!project) return null;
      return { project, blockedCount };
    })
    .filter((row): row is TodayBlockedProjectRef => row !== null)
    .sort((a, b) => b.blockedCount - a.blockedCount);
}

function selectHighPriorityOpen(
  tasks: Task[],
  projects: Project[],
): TodayTaskRef[] {
  return (tasks ?? [])
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
  const tasks = state.tasks ?? [];
  const projects = state.projects ?? [];

  return {
    generatedAt: referenceDate.toISOString(),
    dueToday: selectDueTodayTasks(tasks, projects, today),
    overdue: selectOverdueTasks(tasks, projects, today),
    blocked: selectBlockedTasks(tasks, projects),
    blockedProjects: selectBlockedProjects(tasks, projects),
    highPriorityOpen: selectHighPriorityOpen(tasks, projects),
  };
}
