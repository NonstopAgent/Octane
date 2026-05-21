/**
 * generate-signals.ts
 *
 * Rule-based signal generator. Derives Signal objects from the current
 * OctanePersistedState snapshot — no network calls, pure computation.
 *
 * Called on the client after the store hydrates or when the user navigates
 * to the Signals page. The caller should upsertSignals() with the result.
 */

import type { OctanePersistedState } from "@/lib/store/octane-store";
import type { Signal, SignalSeverity, SignalSource, SignalType } from "@/lib/types/signal";

// ─── helpers ───────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

/** Stable deterministic ID so the same logical signal always upserts cleanly. */
function sigId(source: SignalSource, type: SignalType, entityId: string): string {
  return `sig-${source}-${type}-${entityId}`;
}

function makeSignal(
  opts: Pick<Signal, "source" | "type" | "title" | "summary" | "severity"> & {
    entityId: string;
    projectId?: string;
    relatedRecordType?: string;
    relatedRecordId?: string;
    recommendedAction?: string;
    isDerived?: boolean;
  },
): Signal {
  const ts = now();
  return {
    id: sigId(opts.source, opts.type, opts.entityId),
    source: opts.source,
    type: opts.type,
    title: opts.title,
    summary: opts.summary,
    severity: opts.severity,
    status: "new",
    projectId: opts.projectId,
    entityId: opts.entityId,
    relatedRecordType: opts.relatedRecordType,
    relatedRecordId: opts.relatedRecordId,
    recommendedAction: opts.recommendedAction,
    isDerived: opts.isDerived ?? true,
    createdAt: ts,
    updatedAt: ts,
  };
}

function daysBetween(isoA: string, isoB: string): number {
  return Math.floor(
    (new Date(isoB).getTime() - new Date(isoA).getTime()) / (1000 * 60 * 60 * 24),
  );
}

function daysAgo(iso: string): number {
  return daysBetween(iso, new Date().toISOString());
}

function daysUntil(iso: string): number {
  return daysBetween(new Date().toISOString(), iso);
}

// ─── rule modules ──────────────────────────────────────────────────────────

function taskSignals(state: OctanePersistedState): Signal[] {
  const signals: Signal[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const task of state.tasks) {
    if (task.status === "done") continue;

    // Blocked tasks
    if (task.status === "blocked") {
      const severity: SignalSeverity =
        task.priority === "critical" ? "critical" : task.priority === "high" ? "high" : "medium";
      signals.push(
        makeSignal({
          source: "task",
          type: "blocker",
          entityId: task.id,
          projectId: task.projectId,
          relatedRecordType: "task",
          relatedRecordId: task.id,
          severity,
          title: `Blocked: ${task.title}`,
          summary: task.blockerReason
            ? `Task is blocked — ${task.blockerReason}`
            : "Task is marked blocked with no blocker reason recorded.",
          recommendedAction: "Resolve the blocker or re-assign the task.",
        }),
      );
    }

    // Overdue tasks
    if (task.dueDate && task.dueDate < today) {
      const overdueDays = daysUntil(task.dueDate) * -1;
      const severity: SignalSeverity =
        overdueDays > 14 ? "critical" : overdueDays > 7 ? "high" : "medium";
      signals.push(
        makeSignal({
          source: "task",
          type: "risk",
          entityId: `${task.id}-overdue`,
          projectId: task.projectId,
          relatedRecordType: "task",
          relatedRecordId: task.id,
          severity,
          title: `Overdue: ${task.title}`,
          summary: `Task is ${overdueDays} day${overdueDays !== 1 ? "s" : ""} past its due date.`,
          recommendedAction: "Update the due date or mark complete.",
        }),
      );
    }

    // High-priority tasks stuck in_progress for more than 7 days
    if (
      task.status === "in_progress" &&
      (task.priority === "critical" || task.priority === "high") &&
      daysAgo(task.updatedAt) > 7
    ) {
      signals.push(
        makeSignal({
          source: "task",
          type: "risk",
          entityId: `${task.id}-stale`,
          projectId: task.projectId,
          relatedRecordType: "task",
          relatedRecordId: task.id,
          severity: "medium",
          title: `Stale high-priority task: ${task.title}`,
          summary: `This ${task.priority}-priority task has been in progress for ${daysAgo(task.updatedAt)} days without an update.`,
          recommendedAction: "Update task progress or split into smaller steps.",
        }),
      );
    }
  }

  return signals;
}

function projectSignals(state: OctanePersistedState): Signal[] {
  const signals: Signal[] = [];

  for (const project of state.projects) {
    if (project.status === "killed" || project.status === "paused") continue;

    // Projects with no tasks
    const projectTasks = state.tasks.filter((t) => t.projectId === project.id);
    if (projectTasks.length === 0) {
      signals.push(
        makeSignal({
          source: "project",
          type: "risk",
          entityId: `${project.id}-no-tasks`,
          projectId: project.id,
          relatedRecordType: "project",
          relatedRecordId: project.id,
          severity: "low",
          title: `No tasks: ${project.name}`,
          summary: "This project has no tasks. Add tasks to track execution.",
          recommendedAction: "Create at least one task for this project.",
        }),
      );
    }

    // Projects not updated in 14+ days
    const stale = daysAgo(project.updatedAt);
    if (stale > 14) {
      const severity: SignalSeverity = stale > 30 ? "high" : "medium";
      signals.push(
        makeSignal({
          source: "project",
          type: "risk",
          entityId: `${project.id}-stale`,
          projectId: project.id,
          relatedRecordType: "project",
          relatedRecordId: project.id,
          severity,
          title: `Stale project: ${project.name}`,
          summary: `Project hasn't been updated in ${stale} days.`,
          recommendedAction: "Review project status and update progress.",
        }),
      );
    }

    // Active projects with 0% progress
    if (project.status === "building" && project.progress === 0) {
      signals.push(
        makeSignal({
          source: "project",
          type: "progress",
          entityId: `${project.id}-zero-progress`,
          projectId: project.id,
          relatedRecordType: "project",
          relatedRecordId: project.id,
          severity: "low",
          title: `No progress logged: ${project.name}`,
          summary: "Project is in 'Building' phase but shows 0% progress.",
          recommendedAction: "Update project progress or check active tasks.",
        }),
      );
    }

    // Projects with no GitHub/Vercel connection
    const hasConn = state.projectConnections.some(
      (pc) =>
        pc.projectId === project.id &&
        (pc.kind === "github" || pc.kind === "vercel") &&
        pc.status === "linked",
    );
    if (!hasConn && project.status === "building") {
      signals.push(
        makeSignal({
          source: "project",
          type: "connection",
          entityId: `${project.id}-no-repo`,
          projectId: project.id,
          relatedRecordType: "project",
          relatedRecordId: project.id,
          severity: "low",
          title: `No repo linked: ${project.name}`,
          summary: "This building project has no GitHub or Vercel connection.",
          recommendedAction: "Link a GitHub repo or Vercel project.",
        }),
      );
    }
  }

  return signals;
}

function decisionSignals(state: OctanePersistedState): Signal[] {
  const signals: Signal[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const decision of state.decisions) {
    if (decision.status === "reversed" || decision.status === "completed") continue;

    // Overdue review
    if (decision.reviewDate && decision.reviewDate < today) {
      const days = daysUntil(decision.reviewDate) * -1;
      signals.push(
        makeSignal({
          source: "decision",
          type: "decision",
          entityId: `${decision.id}-review`,
          projectId: decision.projectId,
          relatedRecordType: "decision",
          relatedRecordId: decision.id,
          severity: days > 30 ? "high" : "medium",
          title: `Decision review overdue: ${decision.title}`,
          summary: `Review was scheduled ${days} day${days !== 1 ? "s" : ""} ago.`,
          recommendedAction: "Review this decision and mark it resolved or reversed.",
        }),
      );
    }

    // Active decisions under review
    if (decision.status === "under_review") {
      signals.push(
        makeSignal({
          source: "decision",
          type: "approval",
          entityId: `${decision.id}-under-review`,
          projectId: decision.projectId,
          relatedRecordType: "decision",
          relatedRecordId: decision.id,
          severity: "medium",
          title: `Decision needs your input: ${decision.title}`,
          summary: "This decision is marked 'Under Review' and awaiting resolution.",
          recommendedAction: "Make a final call or update the decision status.",
        }),
      );
    }
  }

  return signals;
}

function agentSignals(state: OctanePersistedState): Signal[] {
  const signals: Signal[] = [];

  for (const agent of state.agents) {
    if (agent.status === "error") {
      signals.push(
        makeSignal({
          source: "agent",
          type: "agent",
          entityId: `${agent.id}-error`,
          relatedRecordType: "agent",
          relatedRecordId: agent.id,
          severity: "high",
          title: `Agent error: ${agent.name}`,
          summary: `${agent.name} is in an error state and may need attention.`,
          recommendedAction: "Check agent logs and restart or re-configure.",
        }),
      );
    }

    // Agent idle for 30+ days
    if (agent.status === "idle" && daysAgo(agent.updatedAt) > 30) {
      signals.push(
        makeSignal({
          source: "agent",
          type: "agent",
          entityId: `${agent.id}-idle`,
          relatedRecordType: "agent",
          relatedRecordId: agent.id,
          severity: "low",
          title: `Idle agent: ${agent.name}`,
          summary: `${agent.name} has been idle for ${daysAgo(agent.updatedAt)} days.`,
          recommendedAction: "Assign a task or deactivate the agent.",
        }),
      );
    }
  }

  return signals;
}

function actionSignals(state: OctanePersistedState): Signal[] {
  const signals: Signal[] = [];

  const pendingApprovals = state.octaneActions.filter((a) => a.status === "pending");
  if (pendingApprovals.length > 0) {
    signals.push(
      makeSignal({
        source: "action",
        type: "approval",
        entityId: "pending-actions",
        severity: pendingApprovals.length > 3 ? "high" : "medium",
        title: `${pendingApprovals.length} action${pendingApprovals.length !== 1 ? "s" : ""} awaiting your approval`,
        summary: `You have ${pendingApprovals.length} pending action${pendingApprovals.length !== 1 ? "s" : ""} waiting for review.`,
        recommendedAction: "Review and approve or reject pending actions.",
      }),
    );
  }

  return signals;
}

function connectionSignals(state: OctanePersistedState): Signal[] {
  const signals: Signal[] = [];

  const critical = ["github", "vercel"] as const;

  for (const provider of critical) {
    const conn = state.connections.find((c) => c.provider === provider);
    if (!conn || conn.status === "not_connected") {
      signals.push(
        makeSignal({
          source: "connection",
          type: "connection",
          entityId: `conn-${provider}-missing`,
          severity: "medium",
          title: `${provider.charAt(0).toUpperCase() + provider.slice(1)} not connected`,
          summary: `The ${provider} integration is not connected. Live data for deployments and code activity won't be available.`,
          recommendedAction: `Go to Connections and link your ${provider} account.`,
        }),
      );
    } else if (conn.status === "needs_attention") {
      signals.push(
        makeSignal({
          source: "connection",
          type: "connection",
          entityId: `conn-${provider}-attention`,
          severity: "high",
          title: `${conn.label} needs attention`,
          summary: "This integration is connected but reporting an issue.",
          recommendedAction: "Re-authenticate or check the connection settings.",
        }),
      );
    }
  }

  return signals;
}

function financeSignals(state: OctanePersistedState): Signal[] {
  const signals: Signal[] = [];

  // Simple runway estimate: sum of recent expenses vs income
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 30);
  const cutoffIso = recentCutoff.toISOString().split("T")[0];

  const recent = state.transactions.filter((t) => t.transactionDate >= cutoffIso);
  const income = recent
    .filter((t) => t.type === "revenue" || t.type === "investment")
    .reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const expenses = recent
    .filter((t) => t.type !== "revenue" && t.type !== "investment")
    .reduce((sum, t) => sum + (t.amount ?? 0), 0);

  const burnRate = expenses - income;
  if (burnRate > 0 && expenses > 0) {
    // Cash position unknown — just flag negative cashflow
    signals.push(
      makeSignal({
        source: "finance",
        type: "cost",
        entityId: "finance-burn",
        severity: burnRate > 5000 ? "high" : "medium",
        title: `Negative cashflow — $${burnRate.toLocaleString()} net burn (30d)`,
        summary: `$${income.toLocaleString()} income vs $${expenses.toLocaleString()} expenses in the last 30 days.`,
        recommendedAction: "Review the Finance page and update revenue projections.",
      }),
    );
  }

  return signals;
}

// ─── main export ──────────────────────────────────────────────────────────

/**
 * Derive a fresh set of signals from the current store state.
 * All signals have isDerived=true and status="new".
 * The caller should upsertSignals() — existing signals with the same id
 * will NOT have their status overwritten (upsert only updates data fields,
 * not user-set status). That de-duplication is handled in the store.
 *
 * upsertSignals() preserves triaged status (acknowledged, resolved, dismissed)
 * when refreshing derived signals into the store.
 */
export function generateSignals(state: OctanePersistedState): Signal[] {
  return [
    ...taskSignals(state),
    ...projectSignals(state),
    ...decisionSignals(state),
    ...agentSignals(state),
    ...actionSignals(state),
    ...connectionSignals(state),
    ...financeSignals(state),
  ];
}
