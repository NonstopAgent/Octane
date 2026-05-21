import {
  addDays,
  differenceInCalendarDays,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfDay,
  subHours,
} from "date-fns";

import {
  getMonthlyExpenses,
  getMonthlyRevenue,
  getRunwayMonths,
  isPendingDecisionStatus,
  isProjectStale,
} from "@/lib/dashboard/metrics";
import {
  cashAvailable,
  monthlyBurn,
} from "@/lib/finance/metrics";
import type { OctanePersistedState } from "@/lib/store/octane-store";
import type {
  ActivityLog,
  Agent,
  ComplianceReminder,
  Decision,
  Project,
  Task,
} from "@/lib/types";

export type BriefingTaskRef = {
  task: Task;
  projectName: string;
  daysOverdue: number;
};

export type BriefingProjectRef = {
  project: Project;
  daysSinceUpdate: number;
};

export type BriefingDecisionRef = {
  decision: Decision;
  projectName?: string;
  daysUntilReview: number;
};

export type BriefingDeadline = {
  id: string;
  label: string;
  date: string;
  kind: "task" | "decision";
  detail?: string;
};

export type BriefingComplianceRef = {
  reminder: ComplianceReminder;
  daysUntilDue: number;
};

export type BriefingCashSnapshot = {
  monthlyRevenue: number;
  monthlyExpenses: number;
  runwayMonths: number | null;
};

export type MorningBriefing = {
  generatedAt: string;
  recentActivity24h: ActivityLog[];
  upcomingCompliance: BriefingComplianceRef[];
  cashSnapshot: BriefingCashSnapshot;
  topPriorities: string[];
  overdueTasks: BriefingTaskRef[];
  blockedTasksCount: number;
  upcomingDeadlines: BriefingDeadline[];
  staleProjects: BriefingProjectRef[];
  agentIssues: Agent[];
  financialAlerts: string[];
  decisionsDue: BriefingDecisionRef[];
  suggestedActions: string[];
  operatingPlan: string[];
  topThreeMoves: string[];
  blockedWork: BriefingTaskRef[];
  moneyWatch: string[];
  decisionQueue: BriefingDecisionRef[];
  projectWatchlist: BriefingProjectRef[];
  suggestedFocusOrder: string[];
};

function projectNameById(
  projects: Project[],
  projectId: string,
): string {
  return projects.find((p) => p.id === projectId)?.name ?? "Unknown project";
}

function selectOverdueTasks(
  tasks: Task[],
  projects: Project[],
  today: Date,
): BriefingTaskRef[] {
  return tasks
    .filter((task) => {
      if (task.status === "done" || !task.dueDate) return false;
      return isBefore(startOfDay(parseISO(task.dueDate)), today);
    })
    .map((task) => ({
      task,
      projectName: projectNameById(projects, task.projectId),
      daysOverdue: differenceInCalendarDays(
        today,
        startOfDay(parseISO(task.dueDate!)),
      ),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

function selectBlockedTasks(
  tasks: Task[],
  projects: Project[],
): BriefingTaskRef[] {
  const priorityOrder: Record<Task["priority"], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return tasks
    .filter((t) => t.status === "blocked")
    .map((task) => ({
      task,
      projectName: projectNameById(projects, task.projectId),
      daysOverdue: 0,
    }))
    .sort(
      (a, b) =>
        priorityOrder[b.task.priority] - priorityOrder[a.task.priority],
    );
}

function selectStaleProjects(
  projects: Project[],
  today: Date,
): BriefingProjectRef[] {
  return projects
    .filter((p) => isProjectStale(p, today))
    .map((project) => ({
      project,
      daysSinceUpdate: differenceInCalendarDays(
        today,
        startOfDay(parseISO(project.updatedAt)),
      ),
    }))
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
}

function selectDecisionsDue(
  decisions: Decision[],
  projects: Project[],
  today: Date,
): BriefingDecisionRef[] {
  return decisions
    .filter((decision) => {
      if (!decision.reviewDate || !isPendingDecisionStatus(decision.status)) {
        return false;
      }
      const review = startOfDay(parseISO(decision.reviewDate));
      return review <= today;
    })
    .map((decision) => ({
      decision,
      projectName: decision.projectId
        ? projectNameById(projects, decision.projectId)
        : undefined,
      daysUntilReview: differenceInCalendarDays(
        startOfDay(parseISO(decision.reviewDate!)),
        today,
      ),
    }))
    .sort((a, b) => a.daysUntilReview - b.daysUntilReview);
}

function selectUpcomingDeadlines(
  tasks: Task[],
  decisions: Decision[],
  today: Date,
  horizonDays = 14,
): BriefingDeadline[] {
  const end = addDays(today, horizonDays);
  const window = { start: today, end };

  const taskDeadlines: BriefingDeadline[] = tasks
    .filter((task) => {
      if (task.status === "done" || !task.dueDate) return false;
      const due = startOfDay(parseISO(task.dueDate));
      return isWithinInterval(due, window);
    })
    .map((task) => ({
      id: task.id,
      kind: "task" as const,
      label: task.title,
      date: task.dueDate!,
      detail: `Task · ${task.priority} priority`,
    }));

  const decisionDeadlines: BriefingDeadline[] = decisions
    .filter((decision) => {
      if (!decision.reviewDate || !isPendingDecisionStatus(decision.status)) {
        return false;
      }
      const review = startOfDay(parseISO(decision.reviewDate));
      return isWithinInterval(review, window) && review > today;
    })
    .map((decision) => ({
      id: decision.id,
      kind: "decision" as const,
      label: decision.title,
      date: decision.reviewDate!,
      detail: `Decision review · ${decision.category}`,
    }));

  return [...taskDeadlines, ...decisionDeadlines].sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

function buildSuggestedActions(input: {
  overdueTasks: BriefingTaskRef[];
  blockedCount: number;
  staleProjects: BriefingProjectRef[];
  agentIssues: Agent[];
  decisionsDue: BriefingDecisionRef[];
  financialAlerts: string[];
}): string[] {
  const actions = new Set<string>();

  if (input.overdueTasks.length > 0) {
    actions.add(
      `Clear ${input.overdueTasks.length} overdue task${input.overdueTasks.length === 1 ? "" : "s"} — start with highest priority.`,
    );
  }

  if (input.blockedCount > 0) {
    actions.add(
      `Unblock ${input.blockedCount} task${input.blockedCount === 1 ? "" : "s"} or re-scope dependencies.`,
    );
  }

  for (const { project, daysSinceUpdate } of input.staleProjects.slice(0, 2)) {
    actions.add(
      `Review ${project.name} — no updates in ${daysSinceUpdate} days.`,
    );
  }

  for (const agent of input.agentIssues) {
    actions.add(`Investigate ${agent.name} agent error state.`);
  }

  for (const { decision } of input.decisionsDue.slice(0, 2)) {
    actions.add(`Revisit decision: ${decision.title}.`);
  }

  for (const alert of input.financialAlerts) {
    actions.add(alert);
  }

  if (actions.size === 0) {
    actions.add("No urgent items — focus on highest-impact in-progress work.");
  }

  return [...actions];
}

function buildTopPriorities(input: {
  overdueTasks: BriefingTaskRef[];
  blockedCount: number;
  agentIssues: Agent[];
  decisionsDue: BriefingDecisionRef[];
  financialAlerts: string[];
  staleProjects: BriefingProjectRef[];
}): string[] {
  const priorities: string[] = [];

  for (const agent of input.agentIssues) {
    priorities.push(`${agent.name} is in error — needs attention.`);
  }

  for (const { task, projectName, daysOverdue } of input.overdueTasks.slice(
    0,
    3,
  )) {
    priorities.push(
      `Overdue: ${task.title} (${projectName}, ${daysOverdue}d late).`,
    );
  }

  if (input.blockedCount > 0) {
    priorities.push(
      `${input.blockedCount} blocked task${input.blockedCount === 1 ? "" : "s"} holding progress.`,
    );
  }

  for (const { decision, daysUntilReview } of input.decisionsDue.slice(0, 2)) {
    const label =
      daysUntilReview < 0
        ? `${Math.abs(daysUntilReview)}d overdue`
        : daysUntilReview === 0
          ? "due today"
          : `due in ${daysUntilReview}d`;
    priorities.push(`Decision ${label}: ${decision.title}.`);
  }

  priorities.push(...input.financialAlerts);

  for (const { project } of input.staleProjects
    .filter((p) => p.project.priority === "critical" || p.project.priority === "high")
    .slice(0, 2)) {
    priorities.push(`${project.name} needs a status refresh.`);
  }

  if (priorities.length === 0) {
    priorities.push("Operations look stable — ship the next checkpoint milestone.");
  }

  return priorities.slice(0, 6);
}

function buildOperatingPlan(input: {
  agentIssues: Agent[];
  blockedWork: BriefingTaskRef[];
  overdueTasks: BriefingTaskRef[];
  decisionsDue: BriefingDecisionRef[];
  staleProjects: BriefingProjectRef[];
  financialAlerts: string[];
  upcomingDeadlines: BriefingDeadline[];
}): string[] {
  const plan: string[] = [];

  if (input.agentIssues.length > 0) {
    plan.push("Morning: triage agent errors before other work.");
  }
  if (input.blockedWork.length > 0) {
    plan.push("Mid-morning: unblock critical path tasks.");
  }
  if (input.overdueTasks.length > 0) {
    plan.push("Before lunch: clear overdue tasks or renegotiate dates.");
  }
  if (input.decisionsDue.length > 0) {
    plan.push("Afternoon: decision reviews and sign-offs.");
  }
  if (input.staleProjects.length > 0) {
    plan.push("End of day: project status updates for stale bets.");
  }
  if (input.financialAlerts.length > 0) {
    plan.push("Finance check: review burn vs revenue.");
  }
  if (input.upcomingDeadlines.length > 0) {
    plan.push(
      `Prep ${input.upcomingDeadlines.length} upcoming deadline${input.upcomingDeadlines.length === 1 ? "" : "s"} this week.`,
    );
  }
  if (plan.length === 0) {
    plan.push("Execute top milestone work with minimal context switching.");
  }
  return plan;
}

function buildTopThreeMoves(input: {
  agentIssues: Agent[];
  blockedWork: BriefingTaskRef[];
  overdueTasks: BriefingTaskRef[];
  decisionsDue: BriefingDecisionRef[];
  staleHighPriority: BriefingProjectRef[];
  financialAlerts: string[];
}): string[] {
  const moves: string[] = [];

  if (input.agentIssues[0]) {
    moves.push(`Fix ${input.agentIssues[0].name} agent error.`);
  }
  if (input.blockedWork[0]) {
    moves.push(`Unblock: ${input.blockedWork[0].task.title}.`);
  }
  if (input.overdueTasks[0]) {
    moves.push(`Close overdue: ${input.overdueTasks[0].task.title}.`);
  }
  if (input.decisionsDue[0]) {
    moves.push(`Decision: ${input.decisionsDue[0].decision.title}.`);
  }
  if (input.staleHighPriority[0]) {
    moves.push(`Refresh ${input.staleHighPriority[0].project.name}.`);
  }
  if (input.financialAlerts[0] && moves.length < 3) {
    moves.push(input.financialAlerts[0]);
  }

  if (moves.length === 0) {
    moves.push("Ship the next checkpoint deliverable.");
  }

  return moves.slice(0, 3);
}

function buildSuggestedFocusOrder(input: {
  agentIssues: Agent[];
  blockedCritical: BriefingTaskRef[];
  overdueTasks: BriefingTaskRef[];
  decisionsDue: BriefingDecisionRef[];
  staleHighPriority: BriefingProjectRef[];
  spendingNoRevenue: string[];
  upcomingDeadlines: BriefingDeadline[];
}): string[] {
  const order: string[] = [];

  for (const agent of input.agentIssues) {
    order.push(`[Agent] ${agent.name}`);
  }
  for (const { task } of input.blockedCritical) {
    order.push(`[Blocked] ${task.title}`);
  }
  for (const { task } of input.overdueTasks.slice(0, 3)) {
    order.push(`[Overdue] ${task.title}`);
  }
  for (const { decision } of input.decisionsDue.slice(0, 3)) {
    order.push(`[Decision] ${decision.title}`);
  }
  for (const { project } of input.staleHighPriority.slice(0, 2)) {
    order.push(`[Stale] ${project.name}`);
  }
  for (const alert of input.spendingNoRevenue) {
    order.push(`[Money] ${alert}`);
  }
  for (const deadline of input.upcomingDeadlines.slice(0, 3)) {
    order.push(`[Deadline] ${deadline.label}`);
  }

  if (order.length === 0) {
    order.push("[Focus] Highest-impact in-progress work");
  }

  return order;
}

function buildMoneyWatch(
  state: OctanePersistedState,
  referenceDate: Date,
  financialAlerts: string[],
): string[] {
  const watch = [...financialAlerts];
  const monthlyRev = getMonthlyRevenue(state.transactions, referenceDate);
  const monthlyExp = getMonthlyExpenses(state.transactions, referenceDate);

  for (const project of state.projects) {
    const projectTx = state.transactions.filter(
      (t) => t.projectId === project.id,
    );
    const rev = getMonthlyRevenue(projectTx, referenceDate);
    const exp = getMonthlyExpenses(projectTx, referenceDate);
    if (exp > 0 && rev === 0) {
      watch.push(
        `${project.name}: spending without revenue this month.`,
      );
    }
  }

  if (watch.length === 0) {
    watch.push(
      `Revenue ${monthlyRev.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} vs expenses ${monthlyExp.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} — on track.`,
    );
  }

  return watch;
}

function selectRecentActivity(
  logs: ActivityLog[],
  referenceDate: Date,
): ActivityLog[] {
  const cutoff = subHours(referenceDate, 24).getTime();
  return logs
    .filter((log) => Date.parse(log.createdAt) >= cutoff)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 12);
}

function selectUpcomingCompliance(
  reminders: ComplianceReminder[],
  today: Date,
): BriefingComplianceRef[] {
  const horizon = addDays(today, 30);
  return reminders
    .filter(
      (r) =>
        r.status !== "completed" &&
        r.status !== "cancelled" &&
        r.dueDate,
    )
    .map((reminder) => ({
      reminder,
      daysUntilDue: differenceInCalendarDays(
        startOfDay(parseISO(reminder.dueDate!)),
        today,
      ),
    }))
    .filter(({ reminder, daysUntilDue }) => {
      if (!reminder.dueDate) return false;
      const due = startOfDay(parseISO(reminder.dueDate));
      return (
        daysUntilDue >= 0 &&
        isWithinInterval(due, { start: today, end: horizon })
      );
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, 8);
}

export function generateMorningBriefing(
  state: OctanePersistedState,
  referenceDate: Date = new Date(),
): MorningBriefing {
  const today = startOfDay(referenceDate);
  const recentActivity24h = selectRecentActivity(
    state.activityLogs,
    referenceDate,
  );
  const upcomingCompliance = selectUpcomingCompliance(
    state.complianceReminders,
    today,
  );
  const monthlyRevenue = getMonthlyRevenue(state.transactions, referenceDate);
  const monthlyExpenses = getMonthlyExpenses(state.transactions, referenceDate);
  const cashSnapshot: BriefingCashSnapshot = {
    monthlyRevenue,
    monthlyExpenses,
    runwayMonths: getRunwayMonths(cashAvailable(state.transactions), monthlyBurn(state.transactions)),
  };

  const overdueTasks = selectOverdueTasks(state.tasks, state.projects, today);
  const blockedWork = selectBlockedTasks(state.tasks, state.projects);
  const blockedTasksCount = blockedWork.length;
  const staleProjects = selectStaleProjects(state.projects, today);
  const agentIssues = state.agents.filter((a) => a.status === "error");
  const decisionsDue = selectDecisionsDue(
    state.decisions,
    state.projects,
    today,
  );
  const upcomingDeadlines = selectUpcomingDeadlines(
    state.tasks,
    state.decisions,
    today,
  );

  const financialAlerts: string[] = [];
  if (monthlyExpenses > monthlyRevenue) {
    financialAlerts.push(
      `Monthly burn (${monthlyExpenses.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}) exceeds revenue (${monthlyRevenue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}).`,
    );
  }

  const spendingNoRevenue: string[] = [];
  for (const project of state.projects) {
    const projectTx = state.transactions.filter(
      (t) => t.projectId === project.id,
    );
    const rev = getMonthlyRevenue(projectTx, referenceDate);
    const exp = getMonthlyExpenses(projectTx, referenceDate);
    if (exp > 0 && rev === 0) {
      spendingNoRevenue.push(`${project.name} has expenses but no revenue.`);
    }
  }

  const staleHighPriority = staleProjects.filter(
    (p) =>
      p.project.priority === "critical" || p.project.priority === "high",
  );

  const blockedCritical = blockedWork.filter(
    (b) => b.task.priority === "critical" || b.task.priority === "high",
  );

  const suggestedActions = buildSuggestedActions({
    overdueTasks,
    blockedCount: blockedTasksCount,
    staleProjects,
    agentIssues,
    decisionsDue,
    financialAlerts,
  });

  const topPriorities = buildTopPriorities({
    overdueTasks,
    blockedCount: blockedTasksCount,
    agentIssues,
    decisionsDue,
    financialAlerts,
    staleProjects,
  });

  const operatingPlan = buildOperatingPlan({
    agentIssues,
    blockedWork,
    overdueTasks,
    decisionsDue,
    staleProjects,
    financialAlerts,
    upcomingDeadlines,
  });

  const topThreeMoves = buildTopThreeMoves({
    agentIssues,
    blockedWork,
    overdueTasks,
    decisionsDue,
    staleHighPriority,
    financialAlerts,
  });

  const moneyWatch = buildMoneyWatch(state, referenceDate, financialAlerts);

  const projectWatchlist = staleProjects.slice(0, 6);

  const suggestedFocusOrder = buildSuggestedFocusOrder({
    agentIssues,
    blockedCritical,
    overdueTasks,
    decisionsDue,
    staleHighPriority,
    spendingNoRevenue,
    upcomingDeadlines,
  });

  return {
    generatedAt: referenceDate.toISOString(),
    recentActivity24h,
    upcomingCompliance,
    cashSnapshot,
    topPriorities,
    overdueTasks,
    blockedTasksCount,
    upcomingDeadlines,
    staleProjects,
    agentIssues,
    financialAlerts,
    decisionsDue,
    suggestedActions,
    operatingPlan,
    topThreeMoves,
    blockedWork,
    moneyWatch,
    decisionQueue: decisionsDue,
    projectWatchlist,
    suggestedFocusOrder,
  };
}
