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
  getMonthlyExpenses,
  getMonthlyRevenue,
  isActiveProjectStatus,
  isOpenTaskStatus,
  isPendingDecisionStatus,
  isProjectStale,
} from "@/lib/dashboard/metrics";
import { computeHoldingsHealth } from "@/lib/scoring/holdings-health";
import { computeOctaneScore } from "@/lib/scoring/octane-score";
import type { OctanePersistedState } from "@/lib/store/octane-store";
import type { ActivityLog, Project, Task } from "@/lib/types";

export type OutlookSeverity = "low" | "medium" | "high" | "critical";

export type OutlookInsight = {
  id: string;
  title: string;
  description: string;
  severity: OutlookSeverity;
  category: string;
};

export type OutlookProjectAction = {
  projectId: string;
  projectName: string;
  reason: string;
};

export type OutlookDomain = {
  score: number;
  label: "strong" | "stable" | "mixed" | "at_risk" | "critical";
  summary: string;
  highlights: string[];
};

export type OutlookPlanPhase = {
  theme: string;
  milestones: string[];
  focusAreas: string[];
};

export type OverallOutlookLabel =
  | "strong"
  | "stable"
  | "mixed"
  | "at_risk"
  | "critical";

export type OctaneOutlook = {
  generatedAt: string;
  overallOutlook: OverallOutlookLabel;
  outlookScore: number;
  summary: string;
  topOpportunities: OutlookInsight[];
  topRisks: OutlookInsight[];
  biggestBlockers: OutlookInsight[];
  whatChanged: string[];
  whatIsWorking: string[];
  whatNeedsImprovement: string[];
  recommendedFocus: string[];
  projectsToDoubleDown: OutlookProjectAction[];
  projectsToPauseOrReview: OutlookProjectAction[];
  revenueOutlook: OutlookDomain;
  executionOutlook: OutlookDomain;
  agentOutlook: OutlookDomain;
  holdingsOutlook: OutlookDomain;
  "30DayPlan": OutlookPlanPhase;
  "60DayPlan": OutlookPlanPhase;
  "90DayPlan": OutlookPlanPhase;
};

export type OctaneOutlookInput = Pick<
  OctanePersistedState,
  | "projects"
  | "tasks"
  | "agents"
  | "transactions"
  | "documents"
  | "ipAssets"
  | "entities"
  | "decisions"
  | "roadmapItems"
  | "activityLogs"
  | "workSessions"
  | "inboxItems"
  | "founderNotes"
  | "complianceReminders"
  | "legalQuestions"
  | "formationChecklistItems"
  | "octaneActions"
  | "signals"
>;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreToLabel(score: number): OutlookDomain["label"] {
  if (score >= 80) return "strong";
  if (score >= 65) return "stable";
  if (score >= 50) return "mixed";
  if (score >= 35) return "at_risk";
  return "critical";
}

function overallFromScore(score: number): OverallOutlookLabel {
  return scoreToLabel(score);
}

function computeExecutionScore(
  state: OctaneOutlookInput,
  today: Date,
): { score: number; highlights: string[] } {
  const octane = computeOctaneScore(state as OctanePersistedState, today);
  const openTasks = state.tasks.filter((t) => isOpenTaskStatus(t.status));
  const blocked = state.tasks.filter((t) => t.status === "blocked");
  const overdue = state.tasks.filter((t) => {
    if (t.status === "done" || !t.dueDate) return false;
    return isBefore(startOfDay(parseISO(t.dueDate)), today);
  });
  const done = state.tasks.filter((t) => t.status === "done");
  const completionRate =
    state.tasks.length === 0
      ? 85
      : clampScore((done.length / state.tasks.length) * 100);

  const blockedPenalty =
    openTasks.length === 0
      ? 0
      : (blocked.length / openTasks.length) * 30;
  const overduePenalty = Math.min(25, overdue.length * 5);
  const staleCount = state.projects.filter((p) =>
    isProjectStale(p, today),
  ).length;
  const stalePenalty =
    state.projects.length === 0
      ? 0
      : (staleCount / state.projects.length) * 20;

  const score = clampScore(
    octane.breakdown.taskCompletion * 0.35 +
      octane.breakdown.blockedTasks * 0.3 +
      octane.breakdown.staleProjects * 0.2 +
      completionRate * 0.15 -
      blockedPenalty * 0.1 -
      overduePenalty * 0.05,
  );

  const highlights: string[] = [];
  if (completionRate >= 60) {
    highlights.push(
      `${completionRate}% task completion rate across the portfolio.`,
    );
  }
  if (blocked.length > 0) {
    highlights.push(
      `${blocked.length} blocked task${blocked.length === 1 ? "" : "s"} need resolution.`,
    );
  }
  if (overdue.length > 0) {
    highlights.push(
      `${overdue.length} overdue task${overdue.length === 1 ? "" : "s"} on the clock.`,
    );
  }
  if (staleCount > 0) {
    highlights.push(
      `${staleCount} project${staleCount === 1 ? "" : "s"} without updates in 7+ days.`,
    );
  }
  if (highlights.length === 0) {
    highlights.push("Execution pipeline is moving without major friction.");
  }

  return { score, highlights };
}

function computeRevenueScore(
  state: OctaneOutlookInput,
  referenceDate: Date,
): { score: number; highlights: string[] } {
  const monthlyRev = getMonthlyRevenue(state.transactions, referenceDate);
  const monthlyExp = getMonthlyExpenses(state.transactions, referenceDate);
  const highlights: string[] = [];

  let score = 85;
  if (monthlyExp > 0 && monthlyRev === 0) {
    score = 38;
    highlights.push("Monthly spend with no recorded revenue.");
  } else if (monthlyExp > monthlyRev) {
    score = 52;
    highlights.push("Burn exceeds revenue this month.");
  } else if (monthlyRev > 0) {
    score = 88;
    highlights.push("Revenue covers or exceeds monthly expenses.");
  } else {
    score = 72;
    highlights.push("No material spend or revenue logged this month.");
  }

  const projectsSpendingNoRev = state.projects.filter((project) => {
    const tx = state.transactions.filter((t) => t.projectId === project.id);
    const rev = getMonthlyRevenue(tx, referenceDate);
    const exp = getMonthlyExpenses(tx, referenceDate);
    return exp > 0 && rev === 0;
  });
  if (projectsSpendingNoRev.length > 0) {
    score = clampScore(score - projectsSpendingNoRev.length * 8);
    highlights.push(
      `${projectsSpendingNoRev.length} project${projectsSpendingNoRev.length === 1 ? "" : "s"} spending without revenue.`,
    );
  }

  return { score: clampScore(score), highlights };
}

function computeProjectQualityScore(
  state: OctaneOutlookInput,
  today: Date,
): { score: number; highlights: string[] } {
  const active = state.projects.filter((p) => isActiveProjectStatus(p.status));
  const stale = state.projects.filter((p) => isProjectStale(p, today));
  const highProgress = active.filter((p) => p.progress >= 60);
  const paused = state.projects.filter(
    (p) => p.status === "paused" || p.status === "killed",
  );

  const staleRatio =
    state.projects.length === 0 ? 0 : stale.length / state.projects.length;
  const progressAvg =
    active.length === 0
      ? 50
      : active.reduce((s, p) => s + p.progress, 0) / active.length;

  const score = clampScore(
    100 - staleRatio * 45 - paused.length * 6 + progressAvg * 0.25,
  );

  const highlights: string[] = [];
  if (highProgress.length > 0) {
    highlights.push(
      `${highProgress.length} active build${highProgress.length === 1 ? "" : "s"} past 60% progress.`,
    );
  }
  if (stale.length > 0) {
    highlights.push(`${stale.length} stale project${stale.length === 1 ? "" : "s"} need status refresh.`);
  }
  if (paused.length > 0) {
    highlights.push(
      `${paused.length} paused or killed bet${paused.length === 1 ? "" : "s"} in portfolio.`,
    );
  }
  if (highlights.length === 0) {
    highlights.push("Project portfolio mix looks intentional.");
  }

  return { score, highlights };
}

function computeAgentHealthScore(state: OctaneOutlookInput): {
  score: number;
  highlights: string[];
} {
  const errors = state.agents.filter((a) => a.status === "error");
  const running = state.agents.filter((a) => a.status === "running");
  const idle = state.agents.filter((a) => a.status === "idle");

  const score =
    state.agents.length === 0
      ? 75
      : clampScore(
          100 -
            (errors.length / state.agents.length) * 100 +
            (running.length / state.agents.length) * 15,
        );

  const highlights: string[] = [];
  if (running.length > 0) {
    highlights.push(
      `${running.length} agent${running.length === 1 ? "" : "s"} actively running.`,
    );
  }
  if (errors.length > 0) {
    highlights.push(
      `${errors.length} agent${errors.length === 1 ? "" : "s"} in error — triage required.`,
    );
  }
  if (idle.length > 0 && errors.length === 0) {
    highlights.push(
      `${idle.length} idle agent${idle.length === 1 ? "" : "s"} available for assignment.`,
    );
  }
  if (highlights.length === 0) {
    highlights.push("No agents configured — automation layer is idle.");
  }

  return { score, highlights };
}

function computeStrategicClarityScore(
  state: OctaneOutlookInput,
  today: Date,
): { score: number; highlights: string[] } {
  const pendingRoadmap = state.roadmapItems.filter(
    (r) => r.status === "planned" || r.status === "in_progress",
  );
  const decisionsDue = state.decisions.filter(
    (d) =>
      isPendingDecisionStatus(d.status) &&
      d.reviewDate &&
      new Date(d.reviewDate) <= today,
  );
  const openInbox = state.inboxItems.filter((i) => i.status === "unprocessed");
  const recentNotes = state.founderNotes.filter((n) => {
    const created = parseISO(n.createdAt);
    return differenceInCalendarDays(today, created) <= 14;
  });

  let score = 80;
  if (decisionsDue.length > 0) score -= decisionsDue.length * 10;
  if (openInbox.length > 8) score -= 12;
  if (pendingRoadmap.length === 0 && state.roadmapItems.length > 0) {
    score -= 8;
  }
  if (recentNotes.length > 0) score += 5;

  score = clampScore(score);

  const highlights: string[] = [];
  if (pendingRoadmap.length > 0) {
    highlights.push(
      `${pendingRoadmap.length} roadmap item${pendingRoadmap.length === 1 ? "" : "s"} in flight.`,
    );
  }
  if (decisionsDue.length > 0) {
    highlights.push(
      `${decisionsDue.length} decision${decisionsDue.length === 1 ? "" : "s"} awaiting review.`,
    );
  }
  if (openInbox.length > 0) {
    highlights.push(
      `${openInbox.length} inbox item${openInbox.length === 1 ? "" : "s"} need triage.`,
    );
  }
  if (highlights.length === 0) {
    highlights.push("Strategic queue is clear — good time to set next bets.");
  }

  return { score, highlights };
}

function buildDomainOutlook(
  score: number,
  summary: string,
  highlights: string[],
): OutlookDomain {
  return {
    score,
    label: scoreToLabel(score),
    summary,
    highlights: highlights.slice(0, 4),
  };
}

function buildWhatChanged(
  activityLogs: ActivityLog[],
  tasks: Task[],
  referenceDate: Date,
): string[] {
  const today = startOfDay(referenceDate);
  const weekAgo = subDays(today, 7);
  const twoWeeksAgo = subDays(today, 14);
  const changes: string[] = [];

  const recentLogs = activityLogs.filter((log) => {
    const at = parseISO(log.createdAt);
    return isWithinInterval(at, { start: weekAgo, end: today });
  });
  const priorLogs = activityLogs.filter((log) => {
    const at = parseISO(log.createdAt);
    return isWithinInterval(at, { start: twoWeeksAgo, end: weekAgo });
  });

  if (recentLogs.length > priorLogs.length) {
    changes.push(
      `Activity up ${recentLogs.length - priorLogs.length} events vs prior week (${recentLogs.length} this week).`,
    );
  } else if (recentLogs.length < priorLogs.length && priorLogs.length > 0) {
    changes.push(
      `Activity slowed — ${recentLogs.length} events this week vs ${priorLogs.length} last week.`,
    );
  }

  const completedThisWeek = tasks.filter((t) => {
    if (t.status !== "done" || !t.completedAt) return false;
    const at = parseISO(t.completedAt);
    return isWithinInterval(at, { start: weekAgo, end: today });
  });
  if (completedThisWeek.length > 0) {
    changes.push(
      `${completedThisWeek.length} task${completedThisWeek.length === 1 ? "" : "s"} completed in the last 7 days.`,
    );
  }

  const newTasks = tasks.filter((t) => {
    const at = parseISO(t.createdAt);
    return isWithinInterval(at, { start: weekAgo, end: today });
  });
  if (newTasks.length > completedThisWeek.length + 2) {
    changes.push(
      `Backlog grew — ${newTasks.length} new tasks added vs ${completedThisWeek.length} completions.`,
    );
  }

  if (changes.length === 0) {
    changes.push("No major week-over-week shifts detected in activity or tasks.");
  }

  return changes.slice(0, 5);
}

function selectDoubleDownProjects(
  projects: Project[],
  tasks: Task[],
): OutlookProjectAction[] {
  return projects
    .filter((p) => isActiveProjectStatus(p.status))
    .map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const open = projectTasks.filter((t) => isOpenTaskStatus(t.status));
      const blocked = open.filter((t) => t.status === "blocked");
      const momentum =
        project.progress >= 50 &&
        blocked.length === 0 &&
        (project.priority === "critical" || project.priority === "high");
      return { project, momentum, open: open.length, blocked: blocked.length };
    })
    .filter((x) => x.momentum)
    .sort((a, b) => b.project.progress - a.project.progress)
    .slice(0, 4)
    .map(({ project, open }) => ({
      projectId: project.id,
      projectName: project.name,
      reason: `${project.progress}% progress · ${open} open tasks · ${project.priority} priority`,
    }));
}

function selectPauseOrReviewProjects(
  projects: Project[],
  today: Date,
  transactions: OctanePersistedState["transactions"],
  referenceDate: Date,
): OutlookProjectAction[] {
  const actions: OutlookProjectAction[] = [];

  for (const project of projects) {
    if (project.status === "paused" || project.status === "killed") {
      actions.push({
        projectId: project.id,
        projectName: project.name,
        reason: `Status is ${project.status} — confirm keep vs archive.`,
      });
      continue;
    }
    if (isProjectStale(project, today)) {
      actions.push({
        projectId: project.id,
        projectName: project.name,
        reason: "No updates in 7+ days — refresh status or pause.",
      });
      continue;
    }
    const tx = transactions.filter((t) => t.projectId === project.id);
    const rev = getMonthlyRevenue(tx, referenceDate);
    const exp = getMonthlyExpenses(tx, referenceDate);
    if (exp > 500 && rev === 0 && project.status !== "idea") {
      actions.push({
        projectId: project.id,
        projectName: project.name,
        reason: "Spending without revenue this month — review ROI.",
      });
    }
  }

  return actions.slice(0, 6);
}

function buildPlanPhases(input: {
  recommendedFocus: string[];
  projectsToDoubleDown: OutlookProjectAction[];
  topRisks: OutlookInsight[];
  roadmapCount: number;
}): {
  day30: OutlookPlanPhase;
  day60: OutlookPlanPhase;
  day90: OutlookPlanPhase;
} {
  const focus = input.recommendedFocus.slice(0, 3);
  const bets = input.projectsToDoubleDown.map((p) => p.projectName);

  return {
    day30: {
      theme: "Stabilize execution and clear blockers",
      milestones: [
        "Clear critical blockers and overdue tasks",
        "Refresh stale project statuses",
        ...input.topRisks.slice(0, 1).map((r) => `Mitigate: ${r.title}`),
      ],
      focusAreas: focus.length > 0 ? focus : ["Unblock highest-priority work"],
    },
    day60: {
      theme: "Accelerate winning bets",
      milestones: [
        ...bets.slice(0, 2).map((name) => `Ship milestone on ${name}`),
        "Close or defer open decisions",
        "Review monthly burn vs revenue",
      ],
      focusAreas:
        bets.length > 0
          ? bets
          : ["Advance top 2 active projects to next milestone"],
    },
    day90: {
      theme: "Strategic portfolio alignment",
      milestones: [
        "Pause or kill low-ROI projects",
        `${input.roadmapCount > 0 ? "Advance roadmap" : "Define roadmap"} for next quarter`,
        "Holdings and compliance calendar current",
      ],
      focusAreas: [
        "Portfolio concentration on highest-conviction bets",
        "Entity and IP hygiene",
        "Agent automation for repeatable ops",
      ],
    },
  };
}

export function generateOctaneOutlook(
  state: OctaneOutlookInput,
  referenceDate: Date = new Date(),
): OctaneOutlook {
  const today = startOfDay(referenceDate);
  const briefing = generateMorningBriefing(
    state as OctanePersistedState,
    referenceDate,
  );
  const holdings = computeHoldingsHealth(state, referenceDate);

  const execution = computeExecutionScore(state, today);
  const revenue = computeRevenueScore(state, referenceDate);
  const projectQuality = computeProjectQualityScore(state, today);
  const agentHealth = computeAgentHealthScore(state);
  const strategic = computeStrategicClarityScore(state, today);

  const dimensionScores = {
    execution: execution.score,
    revenue: revenue.score,
    projectQuality: projectQuality.score,
    agentHealth: agentHealth.score,
    ownershipLegal: holdings.score,
    strategicClarity: strategic.score,
  };

  const outlookScore = clampScore(
    dimensionScores.execution * 0.25 +
      dimensionScores.revenue * 0.2 +
      dimensionScores.projectQuality * 0.2 +
      dimensionScores.agentHealth * 0.15 +
      dimensionScores.ownershipLegal * 0.1 +
      dimensionScores.strategicClarity * 0.1,
  );

  const overallOutlook = overallFromScore(outlookScore);

  const topOpportunities: OutlookInsight[] = [];
  const topRisks: OutlookInsight[] = [];
  const biggestBlockers: OutlookInsight[] = [];

  for (const project of state.projects.filter(
    (p) => p.progress >= 50 && isActiveProjectStatus(p.status),
  ).slice(0, 3)) {
    topOpportunities.push({
      id: `opp-project-${project.id}`,
      title: `Momentum on ${project.name}`,
      description: `${project.progress}% complete · ${project.status} · ${project.priority} priority`,
      severity: "medium",
      category: "projects",
    });
  }

  if (revenue.score >= 70 && getMonthlyRevenue(state.transactions, referenceDate) > 0) {
    topOpportunities.push({
      id: "opp-revenue",
      title: "Revenue signal this month",
      description: "Monthly revenue is tracking — consider doubling down on monetizing bets.",
      severity: "low",
      category: "finance",
    });
  }

  const runningAgents = state.agents.filter((a) => a.status === "running");
  if (runningAgents.length > 0) {
    topOpportunities.push({
      id: "opp-agents",
      title: "Agent capacity available",
      description: `${runningAgents.length} agent${runningAgents.length === 1 ? "" : "s"} running — assign to repetitive workflows.`,
      severity: "low",
      category: "agents",
    });
  }

  for (const agent of state.agents.filter((a) => a.status === "error")) {
    topRisks.push({
      id: `risk-agent-${agent.id}`,
      title: `${agent.name} agent error`,
      description: agent.purpose || "Agent halted — investigate before relying on automation.",
      severity: "critical",
      category: "agents",
    });
  }

  if (getMonthlyExpenses(state.transactions, referenceDate) >
    getMonthlyRevenue(state.transactions, referenceDate)) {
    topRisks.push({
      id: "risk-burn",
      title: "Burn exceeds revenue",
      description: briefing.financialAlerts[0] ?? "Monthly expenses outpace revenue.",
      severity: "high",
      category: "finance",
    });
  }

  if (holdings.score < 60) {
    topRisks.push({
      id: "risk-holdings",
      title: "Holdings health below target",
      description: holdings.suggestions[0] ?? "Entity, IP, or compliance gaps need attention.",
      severity: "high",
      category: "holdings",
    });
  }

  for (const { task, projectName, daysOverdue } of briefing.overdueTasks.slice(
    0,
    3,
  )) {
    biggestBlockers.push({
      id: `blocker-overdue-${task.id}`,
      title: task.title,
      description: `${daysOverdue}d overdue on ${projectName}`,
      severity: daysOverdue > 7 ? "critical" : "high",
      category: "tasks",
    });
  }

  for (const { task, projectName } of briefing.blockedWork.slice(0, 3)) {
    biggestBlockers.push({
      id: `blocker-blocked-${task.id}`,
      title: task.title,
      description: `Blocked on ${projectName}`,
      severity: task.priority === "critical" ? "critical" : "high",
      category: "tasks",
    });
  }

  for (const { decision } of briefing.decisionsDue.slice(0, 2)) {
    biggestBlockers.push({
      id: `blocker-decision-${decision.id}`,
      title: decision.title,
      description: "Decision review overdue or due today",
      severity: "medium",
      category: "decisions",
    });
  }

  const whatChanged = buildWhatChanged(
    state.activityLogs,
    state.tasks,
    referenceDate,
  );

  const whatIsWorking: string[] = [];
  if (execution.score >= 70) {
    whatIsWorking.push("Task execution and project updates are on track.");
  }
  if (revenue.score >= 70) {
    whatIsWorking.push("Revenue and expense balance is healthy this month.");
  }
  if (agentHealth.score >= 80 && state.agents.some((a) => a.status === "running")) {
    whatIsWorking.push("Agent layer is operational with active runs.");
  }
  if (holdings.score >= 75) {
    whatIsWorking.push("Holdings structure scores well on entity and compliance checks.");
  }
  const completedSessions = state.workSessions.filter(
    (s) => s.status === "completed",
  );
  if (completedSessions.length >= 3) {
    whatIsWorking.push(
      `${completedSessions.length} completed work sessions logged — focus time is documented.`,
    );
  }
  if (whatIsWorking.length === 0) {
    whatIsWorking.push("Foundation data is in place — prioritize clearing blockers next.");
  }

  const whatNeedsImprovement: string[] = [];
  if (execution.score < 65) {
    whatNeedsImprovement.push("Execution velocity — unblock tasks and refresh stale projects.");
  }
  if (revenue.score < 65) {
    whatNeedsImprovement.push("Revenue efficiency — align spend to bets with monetization paths.");
  }
  if (strategic.score < 65) {
    whatNeedsImprovement.push("Strategic clarity — triage inbox and close open decisions.");
  }
  if (holdings.score < 65) {
    whatNeedsImprovement.push("Ownership hygiene — address holdings suggestions in order.");
  }
  whatNeedsImprovement.push(...holdings.suggestions.slice(0, 2));
  if (whatNeedsImprovement.length === 0) {
    whatNeedsImprovement.push("Maintain cadence — weekly review and roadmap updates.");
  }

  const recommendedFocus = [
    ...briefing.topThreeMoves,
    ...briefing.suggestedFocusOrder.slice(0, 4),
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 6);

  const projectsToDoubleDown = selectDoubleDownProjects(
    state.projects,
    state.tasks,
  );
  const projectsToPauseOrReview = selectPauseOrReviewProjects(
    state.projects,
    today,
    state.transactions,
    referenceDate,
  );

  const summaryParts = [
    `Outlook score ${outlookScore}/100 (${overallOutlook.replace("_", " ")}).`,
    `${state.projects.filter((p) => isActiveProjectStatus(p.status)).length} active projects, ${state.tasks.filter((t) => isOpenTaskStatus(t.status)).length} open tasks.`,
  ];
  if (topRisks.length > 0) {
    summaryParts.push(`Top risk: ${topRisks[0].title}.`);
  } else if (topOpportunities.length > 0) {
    summaryParts.push(`Top opportunity: ${topOpportunities[0].title}.`);
  }

  const plans = buildPlanPhases({
    recommendedFocus,
    projectsToDoubleDown,
    topRisks,
    roadmapCount: state.roadmapItems.length,
  });

  return {
    generatedAt: referenceDate.toISOString(),
    overallOutlook,
    outlookScore,
    summary: summaryParts.join(" "),
    topOpportunities: topOpportunities.slice(0, 6),
    topRisks: topRisks.slice(0, 6),
    biggestBlockers: biggestBlockers.slice(0, 6),
    whatChanged,
    whatIsWorking: whatIsWorking.slice(0, 5),
    whatNeedsImprovement: [...new Set(whatNeedsImprovement)].slice(0, 6),
    recommendedFocus,
    projectsToDoubleDown,
    projectsToPauseOrReview,
    revenueOutlook: buildDomainOutlook(
      revenue.score,
      revenue.score >= 70
        ? "Revenue outlook is stable or positive for the current month."
        : "Revenue outlook needs attention — burn or project spend without returns.",
      revenue.highlights,
    ),
    executionOutlook: buildDomainOutlook(
      execution.score,
      execution.score >= 70
        ? "Execution is healthy — keep clearing blockers proactively."
        : "Execution is strained — overdue, blocked, or stale work is accumulating.",
      execution.highlights,
    ),
    agentOutlook: buildDomainOutlook(
      agentHealth.score,
      state.agents.length === 0
        ? "No agents configured — automation is an untapped lever."
        : agentHealth.score >= 70
          ? "Agent fleet is mostly healthy."
          : "Agent errors or idle capacity need a pass.",
      agentHealth.highlights,
    ),
    holdingsOutlook: buildDomainOutlook(
      holdings.score,
      holdings.score >= 70
        ? "Holdings and compliance posture is solid."
        : "Holdings score flags entity, IP, or calendar gaps.",
      holdings.suggestions.slice(0, 4),
    ),
    "30DayPlan": plans.day30,
    "60DayPlan": plans.day60,
    "90DayPlan": plans.day90,
  };
}
