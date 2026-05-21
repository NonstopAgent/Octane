import {
  differenceInCalendarDays,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";

import { generateMorningBriefing } from "@/lib/briefing/generate-briefing";
import {
  formatCurrency,
  formatRunway,
  getCashAvailable,
  getMonthlyExpenses,
  getMonthlyRevenue,
  getRunwayMonths,
  isActiveProjectStatus,
  isOpenTaskStatus,
  isPendingDecisionStatus,
  isProjectStale,
} from "@/lib/dashboard/metrics";
import {
  countIpOwnershipGaps,
  countLegalDocumentsNeedingReview,
  countOpenLegalQuestions,
  countOverdueComplianceReminders,
  formationChecklistProgress,
} from "@/lib/holdings/metrics";
import { computeHoldingsHealth } from "@/lib/scoring/holdings-health";
import { computeOctaneScore } from "@/lib/scoring/octane-score";
import type { OctanePersistedState } from "@/lib/store/octane-store";
import type { Project, Task } from "@/lib/types";

import { computeSignalOutlookAdjustment } from "@/lib/outlook/signal-outlook-adjustments";
import { rankSignalSeverity } from "@/lib/signals/vercel-deployment-signals";
import type { Signal, SignalSeverity } from "@/lib/types/signal";

import type {
  ExecutiveAnswer,
  ExecutiveAnswerInput,
  ExecutiveConfidence,
  ExecutiveQuestionCategory,
  ExecutiveSupportingSignal,
  ExecutiveSignalSeverity,
} from "./types";

function executiveSeverityFromSignal(
  severity: SignalSeverity,
): ExecutiveSignalSeverity {
  if (severity === "critical") return "critical";
  if (severity === "high") return "warning";
  return "info";
}

/** Top critical/high live signals (Vercel failures, Gmail risk/finance) for executive answers. */
export function selectTopUniversalSignals(
  state: ExecutiveAnswerInput,
  limit = 6,
): Signal[] {
  const active = state.signals.filter(
    (s) => s.status !== "resolved" && s.status !== "dismissed",
  );
  const prioritized = active.filter(
    (s) =>
      (s.severity === "critical" || s.severity === "high") &&
      (s.source === "vercel" || s.source === "gmail"),
  );
  return [...prioritized].sort(
    (a, b) => rankSignalSeverity(a.severity) - rankSignalSeverity(b.severity),
  ).slice(0, limit);
}

export function universalSignalsToSupporting(
  signals: Signal[],
): ExecutiveSupportingSignal[] {
  return signals.map((s) => ({
    label:
      s.source === "vercel"
        ? "Vercel deployment"
        : s.source === "gmail"
          ? "Gmail"
          : "Live signal",
    detail: `${s.title} — ${s.summary}`,
    severity: executiveSeverityFromSignal(s.severity),
  }));
}

export function signalOutlookHints(
  state: ExecutiveAnswerInput,
): string[] {
  const adjustment = computeSignalOutlookAdjustment(state);
  if (adjustment.penalty === 0) return [];
  return adjustment.highlights;
}

export function enrichExecutiveAnswerWithLiveSignals(
  answer: ExecutiveAnswer,
  state: ExecutiveAnswerInput,
): ExecutiveAnswer {
  const outlookHints = signalOutlookHints(state);
  const top = selectTopUniversalSignals(state);
  if (top.length === 0 && outlookHints.length === 0) return answer;

  const liveSupporting = universalSignalsToSupporting(top);
  const hintSupporting = outlookHints.map((hint) => ({
    label: "Outlook signal risk",
    detail: hint,
    severity: "warning" as const,
  }));
  const existingLabels = new Set(
    answer.supportingSignals.map((s) => `${s.label}:${s.detail}`),
  );
  const mergedSupporting = [
    ...hintSupporting.filter((s) => !existingLabels.has(`${s.label}:${s.detail}`)),
    ...liveSupporting.filter((s) => !existingLabels.has(`${s.label}:${s.detail}`)),
    ...answer.supportingSignals,
  ].slice(0, 12);

  const vercelProjectIds = top
    .filter((s) => s.source === "vercel" && s.projectId)
    .map((s) => s.projectId as string);

  return {
    ...answer,
    supportingSignals: mergedSupporting,
    relatedProjects: [
      ...new Set([...vercelProjectIds, ...answer.relatedProjects]),
    ].slice(0, 10),
    recommendedActions: [
      ...(outlookHints.length > 0
        ? ["Review /signals and resolve critical items before new bets."]
        : []),
      ...top
        .map((s) => s.recommendedAction)
        .filter((v): v is string => Boolean(v))
        .slice(0, 2),
      ...answer.recommendedActions,
    ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 8),
  };
}

const REVENUE_STATUS_RANK: Record<Project["revenueStatus"], number> = {
  profitable: 5,
  recurring: 4,
  early_revenue: 3,
  pre_revenue: 2,
  none: 1,
};

export function resolveReferenceDate(referenceDate?: Date): Date {
  return referenceDate ?? new Date();
}

export function projectNameById(
  projects: Project[],
  projectId: string,
): string {
  return projects.find((p) => p.id === projectId)?.name ?? "Unknown project";
}

export function selectClosestToRevenueProjects(
  projects: Project[],
): Project[] {
  return [...projects]
    .filter((p) => isActiveProjectStatus(p.status))
    .sort(
      (a, b) =>
        REVENUE_STATUS_RANK[b.revenueStatus] -
          REVENUE_STATUS_RANK[a.revenueStatus] ||
        b.progress - a.progress,
    )
    .slice(0, 5);
}

export function selectRecentActivitySummaries(
  state: OctanePersistedState,
  referenceDate: Date,
  limit = 8,
): string[] {
  const today = startOfDay(referenceDate);
  const weekAgo = subDays(today, 7);
  const summaries: string[] = [];

  const recentLogs = state.activityLogs
    .filter((log) => {
      const at = parseISO(log.createdAt);
      return isWithinInterval(at, { start: weekAgo, end: today });
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, limit);

  for (const log of recentLogs) {
    summaries.push(`${log.entityName}: ${log.description}`);
  }

  const completedThisWeek = state.tasks.filter((task) => {
    if (task.status !== "done") return false;
    const updated = startOfDay(parseISO(task.updatedAt));
    return isWithinInterval(updated, { start: weekAgo, end: today });
  });
  if (completedThisWeek.length > 0) {
    summaries.push(
      `${completedThisWeek.length} task${completedThisWeek.length === 1 ? "" : "s"} marked done this week.`,
    );
  }

  const recentSessions = state.workSessions.filter((session) => {
    const started = parseISO(session.startedAt);
    return isWithinInterval(started, { start: weekAgo, end: today });
  });
  if (recentSessions.length > 0) {
    summaries.push(
      `${recentSessions.length} work session${recentSessions.length === 1 ? "" : "s"} logged in the last 7 days.`,
    );
  }

  const recentDecisions = state.decisions
    .filter((decision) => {
      const updated = startOfDay(parseISO(decision.updatedAt));
      return isWithinInterval(updated, { start: weekAgo, end: today });
    })
    .slice(0, 3);
  for (const decision of recentDecisions) {
    summaries.push(`Decision updated: ${decision.title} (${decision.status}).`);
  }

  const monthTx = state.transactions.filter((txn) => {
    const date = startOfDay(parseISO(txn.transactionDate));
    return isWithinInterval(date, { start: weekAgo, end: today });
  });
  if (monthTx.length > 0) {
    summaries.push(
      `${monthTx.length} finance transaction${monthTx.length === 1 ? "" : "s"} recorded this week.`,
    );
  }

  return summaries.slice(0, limit);
}

export function deriveConfidence(input: {
  category: ExecutiveQuestionCategory;
  signalCount: number;
  hasCoreData: boolean;
}): ExecutiveConfidence {
  if (input.category === "unknown" || !input.hasCoreData) {
    return "low";
  }
  if (input.signalCount >= 3) {
    return "high";
  }
  if (input.signalCount >= 1) {
    return "medium";
  }
  return "low";
}

export function emptyExecutiveAnswer(
  category: ExecutiveQuestionCategory,
  answerTitle: string,
  directAnswer: string,
  confidence: ExecutiveConfidence = "medium",
): ExecutiveAnswer {
  return {
    answerTitle,
    category,
    directAnswer,
    supportingSignals: [],
    recommendedActions: [],
    relatedProjects: [],
    relatedTasks: [],
    relatedDocuments: [],
    relatedDecisions: [],
    relatedHoldings: [],
    relatedAgents: [],
    confidence,
  };
}

export function mergeExecutiveAnswer(
  base: ExecutiveAnswer,
  patch: Partial<ExecutiveAnswer>,
): ExecutiveAnswer {
  return { ...base, ...patch };
}

export function buildPortfolioContext(
  state: ExecutiveAnswerInput,
  referenceDate: Date,
): {
  briefing: ReturnType<typeof generateMorningBriefing>;
  holdings: ReturnType<typeof computeHoldingsHealth>;
  octaneScore: ReturnType<typeof computeOctaneScore>;
  monthlyRevenue: number;
  monthlyExpenses: number;
  cashAvailable: number;
  runwayMonths: number | null;
} {
  const briefing = generateMorningBriefing(state, referenceDate);
  const holdings = computeHoldingsHealth(state, referenceDate);
  const octaneScore = computeOctaneScore(state, referenceDate);
  const monthlyRevenue = getMonthlyRevenue(state.transactions, referenceDate);
  const monthlyExpenses = getMonthlyExpenses(state.transactions, referenceDate);
  const cashAvailable = getCashAvailable(state.transactions);
  const runwayMonths = getRunwayMonths(cashAvailable, monthlyExpenses);

  return {
    briefing,
    holdings,
    octaneScore,
    monthlyRevenue,
    monthlyExpenses,
    cashAvailable,
    runwayMonths,
  };
}

export function ownershipSignals(
  state: ExecutiveAnswerInput,
  referenceDate: Date,
): {
  signals: ExecutiveSupportingSignal[];
  relatedHoldings: string[];
  relatedDocuments: string[];
} {
  const holdings = computeHoldingsHealth(state, referenceDate);
  const signals: ExecutiveSupportingSignal[] = [];
  const relatedHoldings: string[] = [];
  const relatedDocuments: string[] = [];

  signals.push({
    label: "Holdings health",
    detail: `Score ${holdings.score}/100 across entity, IP, and compliance checks.`,
    severity: holdings.score < 50 ? "critical" : holdings.score < 70 ? "warning" : "info",
  });

  const ipGaps = countIpOwnershipGaps(state.ipAssets);
  if (ipGaps > 0) {
    signals.push({
      label: "IP ownership gaps",
      detail: `${ipGaps} asset${ipGaps === 1 ? "" : "s"} have intended vs actual owner mismatches.`,
      severity: "warning",
    });
    for (const asset of state.ipAssets.filter(
      (a) => a.intendedOwnerEntity && a.intendedOwnerEntity !== a.ownerEntity,
    )) {
      relatedHoldings.push(asset.id);
    }
  }

  const docsNeedingReview = countLegalDocumentsNeedingReview(state.documents);
  if (docsNeedingReview > 0) {
    signals.push({
      label: "Documents needing review",
      detail: `${docsNeedingReview} legal/compliance document${docsNeedingReview === 1 ? "" : "s"} flagged for review.`,
      severity: "warning",
    });
    for (const doc of state.documents.filter((d) => d.status === "needs_review")) {
      relatedDocuments.push(doc.id);
    }
  }

  const overdueCompliance = countOverdueComplianceReminders(
    state.complianceReminders,
    referenceDate,
  );
  if (overdueCompliance > 0) {
    signals.push({
      label: "Overdue compliance",
      detail: `${overdueCompliance} compliance reminder${overdueCompliance === 1 ? "" : "s"} past due.`,
      severity: "critical",
    });
    for (const reminder of state.complianceReminders.filter(
      (r) => r.status === "overdue",
    )) {
      relatedHoldings.push(reminder.id);
    }
  }

  const openLegal = countOpenLegalQuestions(state.legalQuestions);
  if (openLegal > 0) {
    signals.push({
      label: "Open legal questions",
      detail: `${openLegal} question${openLegal === 1 ? "" : "s"} still open or researching.`,
      severity: "warning",
    });
    for (const question of state.legalQuestions.filter(
      (q) => q.status === "open" || q.status === "researching",
    )) {
      relatedHoldings.push(question.id);
    }
  }

  const formingEntities = state.entities.filter((e) => e.status === "forming");
  for (const entity of formingEntities) {
    relatedHoldings.push(entity.id);
  }
  if (formingEntities.length > 0) {
    signals.push({
      label: "Entities in formation",
      detail: `${formingEntities.length} entit${formingEntities.length === 1 ? "y" : "ies"} still forming.`,
      severity: "info",
    });
  }

  const { done, total } = formationChecklistProgress(
    state.formationChecklistItems,
  );
  if (total > 0 && done / total < 0.5) {
    signals.push({
      label: "Formation checklist",
      detail: `${done}/${total} formation items complete.`,
      severity: "info",
    });
  }

  for (const suggestion of holdings.suggestions.slice(0, 3)) {
    signals.push({
      label: "Holdings suggestion",
      detail: suggestion,
      severity: "info",
    });
  }

  return { signals, relatedHoldings, relatedDocuments };
}

export function blockedTaskRefs(state: ExecutiveAnswerInput): Task[] {
  return state.tasks.filter((t) => t.status === "blocked");
}

export function overdueOpenTasks(
  state: ExecutiveAnswerInput,
  referenceDate: Date,
): Task[] {
  const today = startOfDay(referenceDate);
  return state.tasks.filter((task) => {
    if (task.status === "done" || !task.dueDate) return false;
    return isBefore(startOfDay(parseISO(task.dueDate)), today);
  });
}

export function staleActiveProjects(
  state: ExecutiveAnswerInput,
  referenceDate: Date,
): Project[] {
  return state.projects.filter(
    (p) => isActiveProjectStatus(p.status) && isProjectStale(p, referenceDate),
  );
}

export function decisionsNeedingReview(
  state: ExecutiveAnswerInput,
  referenceDate: Date,
): string[] {
  const today = startOfDay(referenceDate);
  return state.decisions
    .filter((decision) => {
      if (!decision.reviewDate || !isPendingDecisionStatus(decision.status)) {
        return false;
      }
      return startOfDay(parseISO(decision.reviewDate)) <= today;
    })
    .map((d) => d.id);
}

export function financeSummaryLine(
  monthlyRevenue: number,
  monthlyExpenses: number,
  cashAvailable: number,
  runwayMonths: number | null,
): string {
  return `Month-to-date ${formatCurrency(monthlyRevenue)} revenue vs ${formatCurrency(monthlyExpenses)} expenses; ${formatCurrency(cashAvailable)} cash on hand; runway ${formatRunway(runwayMonths)}.`;
}

export function openWorkCounts(state: ExecutiveAnswerInput): string {
  const activeProjects = state.projects.filter((p) =>
    isActiveProjectStatus(p.status),
  ).length;
  const openTasks = state.tasks.filter((t) => isOpenTaskStatus(t.status)).length;
  return `${activeProjects} active projects and ${openTasks} open tasks.`;
}

export function daysSinceUpdate(
  updatedAt: string,
  referenceDate: Date,
): number {
  return differenceInCalendarDays(
    startOfDay(referenceDate),
    startOfDay(parseISO(updatedAt)),
  );
}
