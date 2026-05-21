import { startOfDay } from "date-fns";

import {
  getMonthlyExpenses,
  getMonthlyRevenue,
  isOpenTaskStatus,
  isPendingDecisionStatus,
  isProjectStale,
} from "@/lib/dashboard/metrics";
import type { OctanePersistedState } from "@/lib/store/octane-store";

import { computeOperationalPenalties } from "@/lib/scoring/operational-penalties";

export interface OctaneScoreBreakdown {
  taskCompletion: number;
  blockedTasks: number;
  staleProjects: number;
  revenueVsExpenses: number;
  agentErrors: number;
  decisionsDue: number;
  documentsReview: number;
  /** Raw composite before operational penalties (0–100). */
  baseScore: number;
  /** Points subtracted for pending risk actions, Vercel failures, untriaged signals. */
  operationalPenalty: number;
}

export interface OctaneScore {
  score: number;
  breakdown: OctaneScoreBreakdown;
  suggestions: string[];
  operationalPenaltyReasons: string[];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeOctaneScore(
  state: OctanePersistedState,
  referenceDate: Date = new Date(),
): OctaneScore {
  const today = startOfDay(referenceDate);
  const tasks = state.tasks;
  const openTasks = tasks.filter((t) => isOpenTaskStatus(t.status));
  const doneTasks = tasks.filter((t) => t.status === "done");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const totalTasks = tasks.length;

  const taskCompletion =
    totalTasks === 0
      ? 85
      : clampScore((doneTasks.length / totalTasks) * 100);

  const blockedComponent =
    openTasks.length === 0
      ? 100
      : clampScore(100 - (blockedTasks.length / openTasks.length) * 100);

  const staleProjects = state.projects.filter((p) => isProjectStale(p, today));
  const staleComponent =
    state.projects.length === 0
      ? 90
      : clampScore(
          100 - (staleProjects.length / state.projects.length) * 100,
        );

  const monthlyRev = getMonthlyRevenue(state.transactions, referenceDate);
  const monthlyExp = getMonthlyExpenses(state.transactions, referenceDate);
  let revenueComponent = 100;
  if (monthlyExp > 0 && monthlyRev === 0) revenueComponent = 40;
  else if (monthlyExp > monthlyRev) revenueComponent = 55;
  else if (monthlyRev > 0) revenueComponent = 90;

  const agentErrors = state.agents.filter((a) => a.status === "error");
  const agentComponent =
    state.agents.length === 0
      ? 90
      : clampScore(
          100 - (agentErrors.length / state.agents.length) * 100,
        );

  const decisionsDue = state.decisions.filter(
    (d) =>
      isPendingDecisionStatus(d.status) &&
      d.reviewDate &&
      new Date(d.reviewDate) <= referenceDate,
  );
  const decisionComponent =
    state.decisions.length === 0
      ? 85
      : clampScore(100 - (decisionsDue.length / state.decisions.length) * 80);

  const docsNeedReview = state.documents.filter(
    (d) => d.status === "needs_review",
  );
  const documentComponent =
    state.documents.length === 0
      ? 90
      : clampScore(
          100 - (docsNeedReview.length / state.documents.length) * 100,
        );

  const breakdown = {
    taskCompletion,
    blockedTasks: blockedComponent,
    staleProjects: staleComponent,
    revenueVsExpenses: revenueComponent,
    agentErrors: agentComponent,
    decisionsDue: decisionComponent,
    documentsReview: documentComponent,
  };

  const weights = {
    taskCompletion: 0.2,
    blockedTasks: 0.15,
    staleProjects: 0.15,
    revenueVsExpenses: 0.15,
    agentErrors: 0.15,
    decisionsDue: 0.1,
    documentsReview: 0.1,
  };

  const baseScore = clampScore(
    breakdown.taskCompletion * weights.taskCompletion +
      breakdown.blockedTasks * weights.blockedTasks +
      breakdown.staleProjects * weights.staleProjects +
      breakdown.revenueVsExpenses * weights.revenueVsExpenses +
      breakdown.agentErrors * weights.agentErrors +
      breakdown.decisionsDue * weights.decisionsDue +
      breakdown.documentsReview * weights.documentsReview,
  );

  const penalties = computeOperationalPenalties(state);
  const score = clampScore(baseScore - penalties.total);

  const breakdownWithPenalty: OctaneScoreBreakdown = {
    ...breakdown,
    baseScore,
    operationalPenalty: penalties.total,
  };

  const suggestions: string[] = [];
  for (const reason of penalties.reasons) {
    suggestions.push(reason);
  }
  if (blockedTasks.length > 0) {
    suggestions.push(
      `Clear ${blockedTasks.length} blocked task${blockedTasks.length === 1 ? "" : "s"} to restore flow.`,
    );
  }
  if (staleProjects.length > 0) {
    suggestions.push(
      `Refresh ${staleProjects.length} stale project${staleProjects.length === 1 ? "" : "s"}.`,
    );
  }
  if (monthlyExp > monthlyRev) {
    suggestions.push("Reduce burn or accelerate revenue this month.");
  }
  if (agentErrors.length > 0) {
    suggestions.push("Fix agents in error state.");
  }
  if (decisionsDue.length > 0) {
    suggestions.push(
      `Review ${decisionsDue.length} decision${decisionsDue.length === 1 ? "" : "s"} past review date.`,
    );
  }
  if (docsNeedReview.length > 0) {
    suggestions.push(
      `Process ${docsNeedReview.length} document${docsNeedReview.length === 1 ? "" : "s"} needing review.`,
    );
  }
  if (taskCompletion < 50 && totalTasks > 5) {
    suggestions.push("Close or archive completed work to improve task hygiene.");
  }
  if (suggestions.length === 0) {
    suggestions.push("Operations are healthy — focus on the next milestone.");
  }

  return {
    score,
    breakdown: breakdownWithPenalty,
    suggestions,
    operationalPenaltyReasons: penalties.reasons,
  };
}
