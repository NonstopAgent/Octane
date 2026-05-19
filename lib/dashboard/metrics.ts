import {
  addDays,
  endOfMonth,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";

import type { OctanePersistedState } from "@/lib/store/octane-store";
import type {
  Agent,
  Decision,
  Document,
  Project,
  Task,
  Transaction,
  TransactionType,
} from "@/lib/types";

const OPERATING_EXPENSE_TYPES: TransactionType[] = [
  "expense",
  "software",
  "contractor",
  "legal",
  "other",
];

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRunway(months: number | null): string {
  if (months === null) return "—";
  if (!Number.isFinite(months)) return "∞";
  return `${months.toFixed(1)} mo`;
}

export function isActiveProjectStatus(status: Project["status"]): boolean {
  return status !== "killed" && status !== "paused";
}

export function isOpenTaskStatus(status: Task["status"]): boolean {
  return status !== "done";
}

export function isActiveAgentStatus(status: Agent["status"]): boolean {
  return status === "running" || status === "idle";
}

export function isPendingDecisionStatus(status: Decision["status"]): boolean {
  return status === "active" || status === "under_review";
}

export function getTransactionsInMonth(
  transactions: Transaction[],
  referenceDate: Date = new Date(),
): Transaction[] {
  const start = startOfMonth(referenceDate);
  const end = endOfMonth(referenceDate);
  return transactions.filter((txn) => {
    const date = parseISO(txn.transactionDate);
    return isWithinInterval(date, { start, end });
  });
}

export function getMonthlyRevenue(
  transactions: Transaction[],
  referenceDate: Date = new Date(),
): number {
  return getTransactionsInMonth(transactions, referenceDate)
    .filter((txn) => txn.type === "revenue")
    .reduce((sum, txn) => sum + txn.amount, 0);
}

export function getMonthlyExpenses(
  transactions: Transaction[],
  referenceDate: Date = new Date(),
): number {
  return getTransactionsInMonth(transactions, referenceDate)
    .filter((txn) => OPERATING_EXPENSE_TYPES.includes(txn.type))
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
}

export function getCashAvailable(transactions: Transaction[]): number {
  return transactions.reduce((sum, txn) => sum + txn.amount, 0);
}

export function getRunwayMonths(
  cashAvailable: number,
  burnRate: number,
): number | null {
  if (burnRate <= 0) return null;
  return cashAvailable / burnRate;
}

export function selectActiveProjectsCount(projects: Project[]): number {
  return projects.filter((p) => isActiveProjectStatus(p.status)).length;
}

export function selectOpenTasksCount(tasks: Task[]): number {
  return tasks.filter((t) => isOpenTaskStatus(t.status)).length;
}

export function selectActiveAgentsCount(agents: Agent[]): number {
  return agents.filter((a) => isActiveAgentStatus(a.status)).length;
}

export function selectPendingDecisionsCount(decisions: Decision[]): number {
  return decisions.filter((d) => isPendingDecisionStatus(d.status)).length;
}

export type ProjectBoardItem = {
  project: Project;
};

export function selectProjectStatusBoard(projects: Project[]): ProjectBoardItem[] {
  return [...projects]
    .filter((p) => isActiveProjectStatus(p.status))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((project) => ({ project }));
}

export function selectAgentActivityFeed(
  agents: Agent[],
  tasks: Task[],
  limit = 6,
): Array<Agent & { currentTaskTitle?: string }> {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  return [...agents]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, limit)
    .map((agent) => ({
      ...agent,
      currentTaskTitle: agent.currentTask
        ? taskById.get(agent.currentTask)?.title
        : undefined,
    }));
}

export function selectRecentDecisions(
  decisions: Decision[],
  limit = 5,
): Decision[] {
  return [...decisions]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, limit);
}

export type CapitalAllocationRow = {
  projectId: string | null;
  projectName: string;
  netAmount: number;
  inflow: number;
  outflow: number;
};

export function selectCapitalAllocation(
  transactions: Transaction[],
  projects: Project[],
): CapitalAllocationRow[] {
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
  const buckets = new Map<string | null, CapitalAllocationRow>();

  const ensureBucket = (projectId: string | null): CapitalAllocationRow => {
    const existing = buckets.get(projectId);
    if (existing) return existing;
    const row: CapitalAllocationRow = {
      projectId,
      projectName: projectId
        ? (projectNameById.get(projectId) ?? "Unknown project")
        : "Unallocated",
      netAmount: 0,
      inflow: 0,
      outflow: 0,
    };
    buckets.set(projectId, row);
    return row;
  };

  for (const txn of transactions) {
    const key = txn.projectId ?? null;
    const row = ensureBucket(key);
    row.netAmount += txn.amount;
    if (txn.amount >= 0) {
      row.inflow += txn.amount;
    } else {
      row.outflow += Math.abs(txn.amount);
    }
  }

  return [...buckets.values()].sort((a, b) => b.netAmount - a.netAmount);
}

export type ComplianceReminder =
  | { kind: "document"; document: Document }
  | { kind: "decision"; decision: Decision; reviewDate: string };

export function selectComplianceReminders(
  documents: Document[],
  decisions: Decision[],
  referenceDate: Date = new Date(),
  horizonDays = 30,
): ComplianceReminder[] {
  const today = startOfDay(referenceDate);
  const horizon = addDays(today, horizonDays);
  const reminders: ComplianceReminder[] = [];

  for (const document of documents) {
    if (document.status === "needs_review") {
      reminders.push({ kind: "document", document });
    }
  }

  for (const decision of decisions) {
    if (!decision.reviewDate || !isPendingDecisionStatus(decision.status)) {
      continue;
    }
    const review = startOfDay(parseISO(decision.reviewDate));
    if (review <= horizon) {
      reminders.push({
        kind: "decision",
        decision,
        reviewDate: decision.reviewDate,
      });
    }
  }

  return reminders.sort((a, b) => {
    const dateA =
      a.kind === "document"
        ? a.document.updatedAt
        : a.reviewDate;
    const dateB =
      b.kind === "document"
        ? b.document.updatedAt
        : b.reviewDate;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });
}

export type DashboardMetrics = {
  activeProjectsCount: number;
  openTasksCount: number;
  activeAgentsCount: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  burnRate: number;
  cashAvailable: number;
  runwayMonths: number | null;
  pendingDecisionsCount: number;
  projectBoard: ProjectBoardItem[];
  agentFeed: ReturnType<typeof selectAgentActivityFeed>;
  recentDecisions: Decision[];
  capitalAllocation: CapitalAllocationRow[];
  complianceReminders: ComplianceReminder[];
};

export function selectDashboardMetrics(
  state: OctanePersistedState,
  referenceDate: Date = new Date(),
): DashboardMetrics {
  const monthlyRevenue = getMonthlyRevenue(state.transactions, referenceDate);
  const monthlyExpenses = getMonthlyExpenses(state.transactions, referenceDate);
  const cashAvailable = getCashAvailable(state.transactions);
  const burnRate = monthlyExpenses;

  return {
    activeProjectsCount: selectActiveProjectsCount(state.projects),
    openTasksCount: selectOpenTasksCount(state.tasks),
    activeAgentsCount: selectActiveAgentsCount(state.agents),
    monthlyRevenue,
    monthlyExpenses,
    burnRate,
    cashAvailable,
    runwayMonths: getRunwayMonths(cashAvailable, burnRate),
    pendingDecisionsCount: selectPendingDecisionsCount(state.decisions),
    projectBoard: selectProjectStatusBoard(state.projects),
    agentFeed: selectAgentActivityFeed(state.agents, state.tasks),
    recentDecisions: selectRecentDecisions(state.decisions),
    capitalAllocation: selectCapitalAllocation(
      state.transactions,
      state.projects,
    ),
    complianceReminders: selectComplianceReminders(
      state.documents,
      state.decisions,
      referenceDate,
    ),
  };
}

export function isProjectStale(
  project: Project,
  referenceDate: Date = new Date(),
  staleDays = 7,
): boolean {
  const cutoff = subDays(startOfDay(referenceDate), staleDays);
  return startOfDay(parseISO(project.updatedAt)) < cutoff;
}
