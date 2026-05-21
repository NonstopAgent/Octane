import {
  addDays,
  differenceInCalendarDays,
  isBefore,
  isWithinInterval,
  startOfDay,
  subHours,
} from "date-fns";

import { safeParseISO } from "@/lib/dates/safe-parse";

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
import { computeOctaneScore } from "@/lib/scoring/octane-score";
import { computeOperationalPenalties } from "@/lib/scoring/operational-penalties";
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
  octaneScore: number;
  octaneScorePenalty: number;
  operationalRiskAlerts: string[];
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
  projectId: string | undefined,
): string {
  if (!projectId) return "";
  return projects.find((p) => p.id === projectId)?.name ?? "";
}

function selectOverdueTasks(
  tasks: Task[],
  projects: Project[],
  today: Date,
): BriefingTaskRef[] {
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
        task,
        projectName: projectNameById(projects, task.projectId) || "Unassigned",
        daysOverdue: differenceInCalendarDays(today, startOfDay(due)),
      };
    })
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
  return (tasks ?? [])
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
  return (projects ?? [])
    .filter((p) => isProjectStale(p, today))
    .map((project) => {
      const updated = safeParseISO(project.updatedAt);
      return {
        project,
        daysSinceUpdate: updated
          ? differenceInCalendarDays(today, startOfDay(updated))
          : 0,
      };
    })
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
}

function selectDecisionsDue(
  decisions: Decision[],
  projects: Project[],
  today: Date,
): BriefingDecisionRef[] {
  return (decisions ?? [])
    .filter((decision) => {
      if (!decision.reviewDate || !isPendingDecisionStatus(decision.status)) {
        return false;
      }
      const review = safeParseISO(decision.reviewDate);
      if (!review) return false;
      return startOfDay(review) <= today;
    })
    .map((decision) => {
      const review = safeParseISO(decision.reviewDate!)!;
      return {
        decision,
        projectName: decision.projectId
          ? projectNameById(projects, decision.projectId) || undefined
          : undefined,
        daysUntilReview: differenceInCalendarDays(startOfDay(review), today),
      };
    })
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

  const taskDeadlines: BriefingDeadline[] = (tasks ?? [])
    .filter((task) => {
      if (task.status === "done" || !task.dueDate) return false;
      const dueParsed = safeParseISO(task.dueDate);
      if (!dueParsed) return false;
      const due = startOfDay(dueParsed);
      return isWithinInterval(due, window);
    })
    .map((task) => ({
      id: task.id,
      kind: "task" as const,
      label: task.title,
      date: task.dueDate!,
      detail: `Task · ${task.priority} priority`,
    }));

  const decisionDeadlines: BriefingDeadline[] = (decisions ?? [])
    .filter((decision) => {
      if (!decision.reviewDate || !isPendingDecisionStatus(decision.status)) {
        return false;
      }
      const reviewParsed = safeParseISO(decision.reviewDate);
      if (!reviewParsed) return false;
      const review = startOfDay(reviewParsed);
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
  const transactions = state.transactions ?? [];
  const projects = state.projects ?? [];
  const monthlyRev = getMonthlyRevenue(transactions, referenceDate);
  const monthlyExp = getMonthlyExpenses(transactions, referenceDate);

  for (const project of projects) {
    const projectTx = transactions.filter(
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
  return (reminders ?? [])
    .filter(
      (r) =>
        r.status !== "completed" &&
        r.status !== "cancelled" &&
        r.dueDate,
    )
    .map((reminder) => {
      const due = safeParseISO(reminder.dueDate!);
      return {
        reminder,
        due,
        daysUntilDue: due
          ? differenceInCalendarDays(startOfDay(due), today)
          : Number.POSITIVE_INFINITY,
      };
    })
    .filter(({ reminder, due, daysUntilDue }) => {
      if (!reminder.dueDate || !due) return false;
      return (
        daysUntilDue >= 0 &&
        isWithinInterval(startOfDay(due), { start: today, end: horizon })
      );
    })
    .map(({ reminder, daysUntilDue }) => ({ reminder, daysUntilDue }))
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, 8);
}

export function generateMorningBriefing(
  state: OctanePersistedState,
  referenceDate: Date = new Date(),
): MorningBriefing {
  const today = startOfDay(referenceDate);
  const tasks = state.tasks ?? [];
  const projects = state.projects ?? [];
  const decisions = state.decisions ?? [];
  const transactions = state.transactions ?? [];
  const agents = state.agents ?? [];
  const activityLogs = state.activityLogs ?? [];
  const complianceReminders = state.complianceReminders ?? [];

  const recentActivity24h = selectRecentActivity(activityLogs, referenceDate);
  const upcomingCompliance = selectUpcomingCompliance(
    complianceReminders,
    today,
  );
  const monthlyRevenue = getMonthlyRevenue(transactions, referenceDate);
  const monthlyExpenses = getMonthlyExpenses(transactions, referenceDate);
  const cashSnapshot: BriefingCashSnapshot = {
    monthlyRevenue,
    monthlyExpenses,
    runwayMonths: getRunwayMonths(
      cashAvailable(transactions),
      monthlyBurn(transactions),
    ),
  };

  const overdueTasks = selectOverdueTasks(tasks, projects, today);
  const blockedWork = selectBlockedTasks(tasks, projects);
  const blockedTasksCount = blockedWork.length;
  const staleProjects = selectStaleProjects(projects, today);
  const agentIssues = agents.filter((a) => a.status === "error");
  const decisionsDue = selectDecisionsDue(decisions, projects, today);
  const upcomingDeadlines = selectUpcomingDeadlines(tasks, decisions, today);

  const financialAlerts: string[] = [];
  if (monthlyExpenses > monthlyRevenue) {
    financialAlerts.push(
      `Monthly burn (${monthlyExpenses.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}) exceeds revenue (${monthlyRevenue.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}).`,
    );
  }

  const spendingNoRevenue: string[] = [];
  for (const project of projects) {
    const projectTx = transactions.filter(
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

  const octaneScoreResult = computeOctaneScore(state, referenceDate);
  const operationalPenalties = computeOperationalPenalties(state);
  const operationalRiskAlerts = operationalPenalties.reasons;
  const suggestedActionsWithOps =
    operationalRiskAlerts.length > 0
      ? [...operationalRiskAlerts.slice(0, 2), ...suggestedActions]
      : suggestedActions;

  return {
    generatedAt: referenceDate.toISOString(),
    octaneScore: octaneScoreResult.score,
    octaneScorePenalty: octaneScoreResult.breakdown.operationalPenalty,
    operationalRiskAlerts,
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
    suggestedActions: suggestedActionsWithOps,
    operatingPlan,
    topThreeMoves,
    blockedWork,
    moneyWatch,
    decisionQueue: decisionsDue,
    projectWatchlist,
    suggestedFocusOrder,
  };
}
