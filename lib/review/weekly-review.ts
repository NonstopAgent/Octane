import {
  endOfWeek,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

import {
  isActiveProjectStatus,
  isPendingDecisionStatus,
  isProjectStale,
} from "@/lib/dashboard/metrics";
import type { OctanePersistedState } from "@/lib/store/octane-store";
import type {
  Agent,
  Decision,
  Document,
  Project,
  Task,
  Transaction,
  WorkSession,
} from "@/lib/types";

export type WeeklyReviewTaskRef = {
  task: Task;
  projectName: string;
};

export type WeeklyReviewProjectRef = {
  project: Project;
  reason: string;
};

export type WeeklyReviewMoney = {
  revenue: number;
  expenses: number;
  net: number;
};

export type WeeklyReview = {
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  completedTasksThisWeek: WeeklyReviewTaskRef[];
  newTasksThisWeek: WeeklyReviewTaskRef[];
  blockedTasks: WeeklyReviewTaskRef[];
  completedWorkSessionsThisWeek: WorkSession[];
  totalWorkMinutesThisWeek: number;
  moneyThisWeek: WeeklyReviewMoney;
  decisionsMadeThisWeek: Decision[];
  projectsAdvanced: WeeklyReviewProjectRef[];
  projectsNeglected: WeeklyReviewProjectRef[];
  suggestedNextWeekPriorities: string[];
};

export type WeeklyReviewInput = Pick<
  OctanePersistedState,
  | "projects"
  | "tasks"
  | "workSessions"
  | "transactions"
  | "decisions"
  | "activityLogs"
  | "agents"
  | "documents"
  | "roadmapItems"
>;

const EXPENSE_TYPES: Transaction["type"][] = [
  "expense",
  "software",
  "contractor",
  "legal",
  "other",
];

function projectNameById(projects: Project[], projectId: string): string {
  return projects.find((p) => p.id === projectId)?.name ?? "Unknown project";
}

function weekInterval(referenceDate: Date) {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
  return { weekStart, weekEnd, interval: { start: weekStart, end: weekEnd } };
}

function isDateInWeek(iso: string | undefined, interval: {
  start: Date;
  end: Date;
}): boolean {
  if (!iso) return false;
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return false;
  return isWithinInterval(date, interval);
}

function taskCompletedInWeek(task: Task, interval: { start: Date; end: Date }) {
  if (task.completedAt && isDateInWeek(task.completedAt, interval)) {
    return true;
  }
  return (
    task.status === "done" &&
    isDateInWeek(task.updatedAt, interval)
  );
}

function isRevenueTransaction(transaction: Transaction): boolean {
  if (transaction.type === "investment") return false;
  return transaction.type === "revenue" || transaction.amount > 0;
}

function isExpenseTransaction(transaction: Transaction): boolean {
  return (
    EXPENSE_TYPES.includes(transaction.type) || transaction.amount < 0
  );
}

function workSessionMinutes(session: WorkSession): number {
  if (session.durationMinutes != null) return session.durationMinutes;
  if (!session.endedAt) return 0;
  return Math.max(
    0,
    Math.round(
      (parseISO(session.endedAt).getTime() -
        parseISO(session.startedAt).getTime()) /
        60_000,
    ),
  );
}

function projectHadActivityThisWeek(
  projectId: string,
  input: WeeklyReviewInput,
  interval: { start: Date; end: Date },
): boolean {
  const { tasks, decisions, transactions, workSessions, activityLogs } = input;

  if (
    tasks.some(
      (t) =>
        t.projectId === projectId && taskCompletedInWeek(t, interval),
    )
  ) {
    return true;
  }

  if (
    decisions.some(
      (d) =>
        d.projectId === projectId && isDateInWeek(d.createdAt, interval),
    )
  ) {
    return true;
  }

  if (
    transactions.some(
      (t) =>
        t.projectId === projectId &&
        isDateInWeek(t.transactionDate, interval),
    )
  ) {
    return true;
  }

  if (
    workSessions.some(
      (s) =>
        s.projectId === projectId &&
        s.status === "completed" &&
        isDateInWeek(s.endedAt, interval),
    )
  ) {
    return true;
  }

  if (
    activityLogs.some(
      (log) =>
        log.entityId &&
        (tasks.find((t) => t.id === log.entityId)?.projectId === projectId ||
          decisions.find((d) => d.id === log.entityId)?.projectId ===
            projectId) &&
        isDateInWeek(log.createdAt, interval),
    )
  ) {
    return true;
  }

  if (
    activityLogs.some((log) => {
      if (!isDateInWeek(log.createdAt, interval)) return false;
      const name = log.entityName.toLowerCase();
      const project = input.projects.find((p) => p.id === projectId);
      return project ? name.includes(project.name.toLowerCase()) : false;
    })
  ) {
    return true;
  }

  return false;
}

function buildSuggestedPriorities(input: {
  tasks: Task[];
  projects: Project[];
  agents: Agent[];
  decisions: Decision[];
  documents: Document[];
  transactions: Transaction[];
  today: Date;
}): string[] {
  const suggestions: string[] = [];
  const priorityOrder: Record<Task["priority"], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  const blocked = input.tasks
    .filter((t) => t.status === "blocked")
    .sort(
      (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority],
    );
  for (const task of blocked.slice(0, 2)) {
    suggestions.push(
      `Unblock ${task.title} (${projectNameById(input.projects, task.projectId)}) — ${task.priority} priority.`,
    );
  }

  const overdue = input.tasks
    .filter((t) => {
      if (t.status === "done" || !t.dueDate) return false;
      return isBefore(startOfDay(parseISO(t.dueDate)), startOfDay(input.today));
    })
    .sort(
      (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority],
    );
  for (const task of overdue.slice(0, 2)) {
    if (suggestions.length >= 7) break;
    suggestions.push(
      `Close overdue task: ${task.title} (${projectNameById(input.projects, task.projectId)}).`,
    );
  }

  for (const agent of input.agents.filter((a) => a.status === "error")) {
    if (suggestions.length >= 7) break;
    suggestions.push(`Investigate ${agent.name} agent error state.`);
  }

  for (const project of input.projects) {
    if (suggestions.length >= 7) break;
    if (!isActiveProjectStatus(project.status)) continue;
    if (project.priority !== "critical" && project.priority !== "high") {
      continue;
    }
    if (isProjectStale(project, input.today)) {
      suggestions.push(
        `Re-engage ${project.name} — no updates in 7+ days (${project.priority} project).`,
      );
    }
  }

  for (const project of input.projects.filter((p) =>
    isActiveProjectStatus(p.status),
  )) {
    if (suggestions.length >= 7) break;
    const projectTxns = input.transactions.filter(
      (t) => t.projectId === project.id,
    );
    const hasExpense = projectTxns.some(isExpenseTransaction);
    const hasRevenue = projectTxns.some(isRevenueTransaction);
    if (hasExpense && !hasRevenue) {
      suggestions.push(
        `Review spend on ${project.name} — expenses without revenue.`,
      );
    }
  }

  for (const decision of input.decisions) {
    if (suggestions.length >= 7) break;
    if (!decision.reviewDate || !isPendingDecisionStatus(decision.status)) {
      continue;
    }
    if (
      isBefore(
        startOfDay(parseISO(decision.reviewDate)),
        startOfDay(input.today),
      ) ||
      startOfDay(parseISO(decision.reviewDate)).getTime() ===
        startOfDay(input.today).getTime()
    ) {
      suggestions.push(`Decision review due: ${decision.title}.`);
    }
  }

  for (const doc of input.documents.filter(
    (d) => d.status === "needs_review",
  )) {
    if (suggestions.length >= 7) break;
    suggestions.push(`Review document: ${doc.name}.`);
  }

  if (suggestions.length === 0) {
    suggestions.push(
      "Maintain momentum — pick one critical project and ship a visible win.",
    );
  }

  return suggestions.slice(0, 7);
}

export function generateWeeklyReview(
  input: WeeklyReviewInput,
  referenceDate: Date = new Date(),
): WeeklyReview {
  const today = startOfDay(referenceDate);
  const { weekStart, weekEnd, interval } = weekInterval(referenceDate);

  const completedTasksThisWeek: WeeklyReviewTaskRef[] = input.tasks
    .filter((task) => taskCompletedInWeek(task, interval))
    .map((task) => ({
      task,
      projectName: projectNameById(input.projects, task.projectId),
    }))
    .sort(
      (a, b) =>
        new Date(b.task.completedAt ?? b.task.updatedAt).getTime() -
        new Date(a.task.completedAt ?? a.task.updatedAt).getTime(),
    );

  const newTasksThisWeek: WeeklyReviewTaskRef[] = input.tasks
    .filter((task) => isDateInWeek(task.createdAt, interval))
    .map((task) => ({
      task,
      projectName: projectNameById(input.projects, task.projectId),
    }))
    .sort(
      (a, b) =>
        new Date(b.task.createdAt).getTime() -
        new Date(a.task.createdAt).getTime(),
    );

  const blockedTasks: WeeklyReviewTaskRef[] = input.tasks
    .filter((task) => task.status === "blocked")
    .map((task) => ({
      task,
      projectName: projectNameById(input.projects, task.projectId),
    }))
    .sort(
      (a, b) =>
        new Date(b.task.updatedAt).getTime() -
        new Date(a.task.updatedAt).getTime(),
    );

  const completedWorkSessionsThisWeek = input.workSessions
    .filter(
      (session) =>
        session.status === "completed" &&
        isDateInWeek(session.endedAt, interval),
    )
    .sort(
      (a, b) =>
        new Date(b.endedAt ?? b.startedAt).getTime() -
        new Date(a.endedAt ?? a.startedAt).getTime(),
    );

  const totalWorkMinutesThisWeek = completedWorkSessionsThisWeek.reduce(
    (sum, session) => sum + workSessionMinutes(session),
    0,
  );

  const weekTransactions = input.transactions.filter((txn) =>
    isDateInWeek(txn.transactionDate, interval),
  );

  const revenue = weekTransactions
    .filter(isRevenueTransaction)
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

  const expenses = weekTransactions
    .filter(isExpenseTransaction)
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

  const moneyThisWeek: WeeklyReviewMoney = {
    revenue,
    expenses,
    net: revenue - expenses,
  };

  const decisionsMadeThisWeek = input.decisions
    .filter((decision) => isDateInWeek(decision.createdAt, interval))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const projectsAdvanced: WeeklyReviewProjectRef[] = input.projects
    .filter(
      (project) =>
        isActiveProjectStatus(project.status) &&
        projectHadActivityThisWeek(project.id, input, interval),
    )
    .map((project) => ({
      project,
      reason: "Activity recorded this week",
    }))
    .sort((a, b) => a.project.name.localeCompare(b.project.name));

  const projectsNeglected: WeeklyReviewProjectRef[] = input.projects
    .filter((project) => {
      if (!isActiveProjectStatus(project.status)) return false;
      if (project.priority !== "critical" && project.priority !== "high") {
        return false;
      }
      return isProjectStale(project, today, 7);
    })
    .map((project) => ({
      project,
      reason: "No updates in 7+ days",
    }))
    .sort((a, b) => a.project.name.localeCompare(b.project.name));

  const suggestedNextWeekPriorities = buildSuggestedPriorities({
    tasks: input.tasks,
    projects: input.projects,
    agents: input.agents,
    decisions: input.decisions,
    documents: input.documents,
    transactions: input.transactions,
    today,
  });

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    completedTasksThisWeek,
    newTasksThisWeek,
    blockedTasks,
    completedWorkSessionsThisWeek,
    totalWorkMinutesThisWeek,
    moneyThisWeek,
    decisionsMadeThisWeek,
    projectsAdvanced,
    projectsNeglected,
    suggestedNextWeekPriorities,
  };
}
