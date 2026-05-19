import { startOfDay } from "date-fns";

import {
  formatCurrency,
  isActiveProjectStatus,
  isOpenTaskStatus,
  isPendingDecisionStatus,
  selectDashboardMetrics,
} from "@/lib/dashboard/metrics";
import { projectPnLTable } from "@/lib/finance/metrics";
import { generateOctaneOutlook } from "@/lib/outlook/generate-octane-outlook";
import type { OctaneOutlookInput } from "@/lib/outlook/generate-octane-outlook";

import {
  blockedTaskRefs,
  buildPortfolioContext,
  decisionsNeedingReview,
  deriveConfidence,
  emptyExecutiveAnswer,
  financeSummaryLine,
  mergeExecutiveAnswer,
  openWorkCounts,
  overdueOpenTasks,
  ownershipSignals,
  projectNameById,
  resolveReferenceDate,
  selectClosestToRevenueProjects,
  selectRecentActivitySummaries,
  staleActiveProjects,
} from "./shared";
import type { ExecutiveAnswer, ExecutiveAnswerInput } from "./types";

function outlookInputFromState(state: ExecutiveAnswerInput): OctaneOutlookInput {
  return {
    projects: state.projects,
    tasks: state.tasks,
    agents: state.agents,
    transactions: state.transactions,
    documents: state.documents,
    ipAssets: state.ipAssets,
    entities: state.entities,
    decisions: state.decisions,
    roadmapItems: state.roadmapItems,
    activityLogs: state.activityLogs,
    workSessions: state.workSessions,
    inboxItems: state.inboxItems,
    founderNotes: state.founderNotes,
    complianceReminders: state.complianceReminders,
    legalQuestions: state.legalQuestions,
    formationChecklistItems: state.formationChecklistItems,
  };
}

export function buildOwnershipAnswer(
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const { signals, relatedHoldings, relatedDocuments } = ownershipSignals(
    state,
    ref,
  );
  const { holdings } = buildPortfolioContext(state, ref);

  const directAnswer =
    holdings.score >= 70
      ? `Holdings posture is solid at ${holdings.score}/100. Entity structure, IP, and compliance calendars are mostly in order — review flagged documents and open questions to stay ahead.`
      : `Holdings need attention (${holdings.score}/100). Prioritize IP ownership alignment, overdue compliance items, and open legal questions before expanding project spend.`;

  const recommendedActions = [
    ...holdings.suggestions.slice(0, 4),
    relatedDocuments.length > 0
      ? "Review documents flagged needs_review in /holdings."
      : "Confirm entity and IP records match intended structure.",
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer("ownership", "Ownership & holdings", directAnswer),
    {
      supportingSignals: signals,
      recommendedActions,
      relatedHoldings,
      relatedDocuments,
      relatedDecisions: decisionsNeedingReview(state, ref),
      confidence: deriveConfidence({
        category: "ownership",
        signalCount: signals.length,
        hasCoreData:
          state.entities.length > 0 ||
          state.documents.length > 0 ||
          state.ipAssets.length > 0,
      }),
    },
  );
}

export function buildBuildingAnswer(
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const { briefing } = buildPortfolioContext(state, ref);

  const activeProjects = state.projects.filter((p) =>
    isActiveProjectStatus(p.status),
  );
  const openTasks = state.tasks.filter((t) => isOpenTaskStatus(t.status));
  const runningAgents = state.agents.filter((a) => a.status === "running");
  const roadmapUpcoming = state.roadmapItems
    .filter(
      (item) =>
        item.status !== "completed" && item.status !== "cancelled",
    )
    .slice(0, 5);

  const signals = [
    {
      label: "Active portfolio",
      detail: openWorkCounts(state),
    },
    {
      label: "Roadmap items",
      detail: `${roadmapUpcoming.length} open roadmap item${roadmapUpcoming.length === 1 ? "" : "s"} on the horizon.`,
    },
    {
      label: "Agent capacity",
      detail: `${runningAgents.length} agent${runningAgents.length === 1 ? "" : "s"} running; ${state.agents.filter((a) => a.status === "error").length} in error.`,
      severity:
        state.agents.some((a) => a.status === "error")
          ? ("warning" as const)
          : ("info" as const),
    },
  ];

  if (briefing.staleProjects.length > 0) {
    signals.push({
      label: "Stale projects",
      detail: `${briefing.staleProjects.length} project${briefing.staleProjects.length === 1 ? "" : "s"} without updates in 7+ days.`,
      severity: "warning",
    });
  }

  const topProject = [...activeProjects]
    .sort((a, b) => {
      const priority = { critical: 4, high: 3, medium: 2, low: 1 };
      return priority[b.priority] - priority[a.priority] || b.progress - a.progress;
    })[0];

  const directAnswer = topProject
    ? `Building focus: ${topProject.name} leads the active portfolio (${topProject.progress}% complete, ${topProject.status}). ${openWorkCounts(state)} Align roadmap items and agent runs to unblock delivery.`
    : `No active projects in the portfolio. Capture the next bet as a project and break it into tasks before assigning agents.`;

  const recommendedActions = [
    ...briefing.suggestedActions.slice(0, 3),
    roadmapUpcoming.length > 0
      ? `Advance roadmap: ${roadmapUpcoming[0].title}.`
      : "Add or refresh roadmap milestones for the next 30 days.",
    runningAgents.length > 0
      ? "Assign running agents to repetitive delivery tasks."
      : "Start or configure agents for repeatable workflows.",
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer("building", "Building & delivery", directAnswer),
    {
      supportingSignals: signals,
      recommendedActions,
      relatedProjects: activeProjects.slice(0, 6).map((p) => p.id),
      relatedTasks: openTasks.slice(0, 8).map((t) => t.id),
      relatedAgents: state.agents.map((a) => a.id),
      confidence: deriveConfidence({
        category: "building",
        signalCount: signals.length,
        hasCoreData: activeProjects.length > 0 || openTasks.length > 0,
      }),
    },
  );
}

export function buildTodayAnswer(
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const { briefing } = buildPortfolioContext(state, ref);

  const directAnswer =
    briefing.topThreeMoves.length > 0
      ? `Today's operating picture: ${briefing.topThreeMoves.join(" ")}`
      : `Operations look stable. ${openWorkCounts(state)} Use the briefing focus order to pick the highest-leverage move.`;

  const signals = briefing.topPriorities.slice(0, 5).map((detail) => ({
    label: "Priority",
    detail,
    severity: detail.toLowerCase().includes("error")
      ? ("critical" as const)
      : detail.toLowerCase().includes("overdue") ||
          detail.toLowerCase().includes("blocked")
        ? ("warning" as const)
        : ("info" as const),
  }));

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer("today", "Today & focus", directAnswer),
    {
      supportingSignals: signals,
      recommendedActions: [
        ...briefing.topThreeMoves,
        ...briefing.suggestedFocusOrder.slice(0, 4),
      ].filter((v, i, arr) => arr.indexOf(v) === i),
      relatedTasks: [
        ...briefing.overdueTasks.map((r) => r.task.id),
        ...briefing.blockedWork.map((r) => r.task.id),
      ].slice(0, 10),
      relatedProjects: briefing.staleProjects
        .slice(0, 5)
        .map((r) => r.project.id),
      relatedDecisions: briefing.decisionsDue.map((r) => r.decision.id),
      relatedAgents: briefing.agentIssues.map((a) => a.id),
      confidence: deriveConfidence({
        category: "today",
        signalCount: signals.length,
        hasCoreData: true,
      }),
    },
  );
}

export function buildBlockersAnswer(
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const blocked = blockedTaskRefs(state);
  const stale = staleActiveProjects(state, ref);
  const errorAgents = state.agents.filter((a) => a.status === "error");
  const openLegal = state.legalQuestions.filter(
    (q) => q.status === "open" && q.priority === "high",
  );
  const overdueCompliance = state.complianceReminders.filter(
    (r) => r.status === "overdue",
  );

  const blockerCount =
    blocked.length +
    stale.length +
    errorAgents.length +
    openLegal.length +
    overdueCompliance.length;

  const directAnswer =
    blockerCount === 0
      ? "No major blockers detected — blocked tasks, stale projects, agent errors, and critical legal/compliance items are clear."
      : `${blockerCount} blocker area${blockerCount === 1 ? "" : "s"} need attention: ${blocked.length} blocked task${blocked.length === 1 ? "" : "s"}, ${stale.length} stale project${stale.length === 1 ? "" : "s"}, ${errorAgents.length} agent error${errorAgents.length === 1 ? "" : "s"}, ${openLegal.length} critical legal question${openLegal.length === 1 ? "" : "s"}, ${overdueCompliance.length} overdue compliance item${overdueCompliance.length === 1 ? "" : "s"}.`;

  const signals = [
    ...blocked.slice(0, 4).map((task) => ({
      label: "Blocked task",
      detail: `${task.title} (${projectNameById(state.projects, task.projectId)}, ${task.priority})`,
      severity: task.priority === "critical" ? ("critical" as const) : ("warning" as const),
    })),
    ...stale.slice(0, 3).map((project) => ({
      label: "Stale project",
      detail: `${project.name} — no updates in 7+ days.`,
      severity: "warning" as const,
    })),
    ...errorAgents.map((agent) => ({
      label: "Agent error",
      detail: `${agent.name} is halted.`,
      severity: "critical" as const,
    })),
    ...openLegal.slice(0, 2).map((q) => ({
      label: "Legal question",
      detail: q.question,
      severity: "warning" as const,
    })),
    ...overdueCompliance.slice(0, 2).map((r) => ({
      label: "Compliance overdue",
      detail: r.title,
      severity: "critical" as const,
    })),
  ];

  const recommendedActions = [
    blocked.length > 0
      ? `Unblock ${blocked[0].title} or re-scope dependencies.`
      : null,
    stale.length > 0 ? `Refresh status on ${stale[0].name}.` : null,
    errorAgents.length > 0
      ? `Investigate ${errorAgents[0].name} agent error.`
      : null,
    openLegal.length > 0
      ? `Research or escalate: ${openLegal[0].question}.`
      : null,
    overdueCompliance.length > 0
      ? `Complete overdue compliance: ${overdueCompliance[0].title}.`
      : null,
  ].filter((v): v is string => Boolean(v));

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer("blockers", "Blockers", directAnswer),
    {
      supportingSignals: signals,
      recommendedActions:
        recommendedActions.length > 0
          ? recommendedActions
          : ["Maintain weekly blocker review to catch drift early."],
      relatedTasks: blocked.map((t) => t.id),
      relatedProjects: stale.map((p) => p.id),
      relatedAgents: errorAgents.map((a) => a.id),
      relatedHoldings: [
        ...openLegal.map((q) => q.id),
        ...overdueCompliance.map((r) => r.id),
      ],
      confidence: deriveConfidence({
        category: "blockers",
        signalCount: signals.length,
        hasCoreData: true,
      }),
    },
  );
}

export function buildChangedAnswer(
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const changes = selectRecentActivitySummaries(state, ref, 10);
  const outlook = generateOctaneOutlook(outlookInputFromState(state), ref);

  const directAnswer =
    changes.length > 0
      ? `Recent shifts: ${changes.slice(0, 3).join(" ")}`
      : "Limited activity in the last 7 days — log work sessions, complete tasks, or record transactions to improve change tracking.";

  const signals = [
    ...changes.slice(0, 6).map((detail) => ({
      label: "Change",
      detail,
    })),
    ...outlook.whatChanged.slice(0, 3).map((detail) => ({
      label: "Outlook delta",
      detail,
    })),
  ];

  const completedTasks = state.tasks
    .filter((t) => t.status === "done")
    .slice(0, 5)
    .map((t) => t.id);

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer("changed", "What changed", directAnswer),
    {
      supportingSignals: signals,
      recommendedActions: [
        "Review activity log for gaps in documentation.",
        "Close the loop on any decisions updated this week.",
        "Reconcile finance entries against project attribution.",
      ],
      relatedTasks: completedTasks,
      relatedDecisions: state.decisions
        .slice(0, 5)
        .map((d) => d.id),
      confidence: deriveConfidence({
        category: "changed",
        signalCount: signals.length,
        hasCoreData:
          state.activityLogs.length > 0 ||
          state.workSessions.length > 0 ||
          state.tasks.length > 0,
      }),
    },
  );
}

export function buildDecisionsAnswer(
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const dueIds = decisionsNeedingReview(state, ref);
  const pending = state.decisions.filter((d) =>
    isPendingDecisionStatus(d.status),
  );
  const dueDecisions = pending.filter((d) => dueIds.includes(d.id));
  const upcoming = pending
    .filter((d) => d.reviewDate && !dueIds.includes(d.id))
    .slice(0, 5);

  const directAnswer =
    dueDecisions.length > 0
      ? `${dueDecisions.length} decision${dueDecisions.length === 1 ? "" : "s"} at or past review date — start with "${dueDecisions[0].title}".`
      : pending.length > 0
        ? `${pending.length} pending decision${pending.length === 1 ? "" : "s"} on file; none are overdue for review.`
        : "No active decisions in the queue — capture strategic choices as decisions with review dates.";

  const signals = [
    ...dueDecisions.slice(0, 5).map((decision) => ({
      label: "Review due",
      detail: `${decision.title} (${decision.status})`,
      severity: "warning" as const,
    })),
    ...upcoming.map((decision) => ({
      label: "Upcoming review",
      detail: `${decision.title} — review ${decision.reviewDate}`,
    })),
  ];

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer("decisions", "Decisions", directAnswer),
    {
      supportingSignals: signals,
      recommendedActions: dueDecisions.map(
        (d) => `Revisit decision: ${d.title} — update status or schedule review.`,
      ),
      relatedDecisions: pending.slice(0, 8).map((d) => d.id),
      relatedProjects: pending
        .filter((d) => d.projectId)
        .map((d) => d.projectId!)
        .slice(0, 6),
      confidence: deriveConfidence({
        category: "decisions",
        signalCount: signals.length,
        hasCoreData: state.decisions.length > 0,
      }),
    },
  );
}

export function buildMoneyAnswer(
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const {
    monthlyRevenue,
    monthlyExpenses,
    cashAvailable,
    runwayMonths,
    briefing,
  } = buildPortfolioContext(state, ref);
  const metrics = selectDashboardMetrics(state, ref);
  const pnl = projectPnLTable(state.transactions, state.projects);
  const closest = selectClosestToRevenueProjects(state.projects);

  const burnGap = monthlyExpenses - monthlyRevenue;
  const directAnswer = `${financeSummaryLine(monthlyRevenue, monthlyExpenses, cashAvailable, runwayMonths)} ${
    burnGap > 0
      ? `Burn exceeds revenue by ${formatCurrency(burnGap)} this month.`
      : "Revenue covers monthly expenses in the current period."
  } Closest to revenue: ${closest
    .slice(0, 3)
    .map((p) => `${p.name} (${p.revenueStatus.replace("_", " ")})`)
    .join(", ") || "no active projects ranked yet"}.`;

  const signals = [
    {
      label: "Monthly P&L",
      detail: `${formatCurrency(monthlyRevenue)} revenue vs ${formatCurrency(monthlyExpenses)} expenses.`,
      severity:
        monthlyExpenses > monthlyRevenue ? ("warning" as const) : ("info" as const),
    },
    {
      label: "Cash & runway",
      detail: `${formatCurrency(cashAvailable)} available; runway ${metrics.runwayMonths === null ? "—" : `${metrics.runwayMonths.toFixed(1)} months`}.`,
    },
    ...pnl
      .filter((row) => row.expenses > 0 && row.revenue === 0)
      .slice(0, 3)
      .map((row) => ({
        label: "Spend without revenue",
        detail: `${row.projectName}: ${formatCurrency(row.expenses)} expenses, no revenue.`,
        severity: "warning" as const,
      })),
    ...briefing.moneyWatch.slice(0, 2).map((detail) => ({
      label: "Money watch",
      detail,
    })),
  ];

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer("money", "Money & finance", directAnswer),
    {
      supportingSignals: signals,
      recommendedActions: [
        ...briefing.financialAlerts,
        ...briefing.moneyWatch.slice(0, 3),
        closest[0]
          ? `Double-check monetization path for ${closest[0].name}.`
          : "Tag projects with revenue status to improve prioritization.",
      ].filter((v, i, arr) => arr.indexOf(v) === i),
      relatedProjects: [
        ...closest.map((p) => p.id),
        ...pnl
          .filter((r) => r.net < 0)
          .slice(0, 3)
          .map((r) => r.projectId),
      ].filter((v, i, arr) => arr.indexOf(v) === i),
      confidence: deriveConfidence({
        category: "money",
        signalCount: signals.length,
        hasCoreData: state.transactions.length > 0,
      }),
    },
  );
}

export function buildAgentsAnswer(
  state: ExecutiveAnswerInput,
  _referenceDate?: Date,
): ExecutiveAnswer {
  const errorAgents = state.agents.filter((a) => a.status === "error");
  const running = state.agents.filter((a) => a.status === "running");
  const idle = state.agents.filter((a) => a.status === "idle");

  const taskById = new Map(state.tasks.map((t) => [t.id, t]));

  const directAnswer =
    state.agents.length === 0
      ? "No agents configured — automation is available but not in use."
      : `${running.length} running, ${idle.length} idle, ${errorAgents.length} in error. ${
          errorAgents.length > 0
            ? `Investigate ${errorAgents.map((a) => a.name).join(", ")} first.`
            : "Fleet is operational — assign current tasks to idle agents."
        }`;

  const signals = state.agents.slice(0, 8).map((agent) => {
    const currentTask = agent.currentTask
      ? taskById.get(agent.currentTask)?.title
      : undefined;
    return {
      label: agent.name,
      detail: `${agent.status}${currentTask ? ` — ${currentTask}` : ""}${agent.purpose ? ` · ${agent.purpose}` : ""}`,
      severity:
        agent.status === "error"
          ? ("critical" as const)
          : agent.status === "running"
            ? ("info" as const)
            : ("warning" as const),
    };
  });

  const recommendedActions = [
    ...errorAgents.map((a) => `Restart or debug ${a.name}.`),
    idle.length > 0 && running.length === 0
      ? `Assign work to idle agent ${idle[0].name}.`
      : null,
    "Review agent logs for failed runs.",
  ].filter((v): v is string => Boolean(v));

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer("agents", "Agents", directAnswer),
    {
      supportingSignals: signals,
      recommendedActions:
        recommendedActions.length > 0
          ? recommendedActions
          : ["Keep agent purposes aligned to active project tasks."],
      relatedAgents: state.agents.map((a) => a.id),
      relatedTasks: state.agents
        .map((a) => a.currentTask)
        .filter((id): id is string => Boolean(id)),
      confidence: deriveConfidence({
        category: "agents",
        signalCount: signals.length,
        hasCoreData: state.agents.length > 0,
      }),
    },
  );
}

export function buildOutlookAnswer(
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const outlook = generateOctaneOutlook(outlookInputFromState(state), ref);

  const directAnswer = `${outlook.summary} Recommended focus: ${outlook.recommendedFocus.slice(0, 3).join(" ")}`;

  const signals = [
    {
      label: "Outlook score",
      detail: `${outlook.outlookScore}/100 (${outlook.overallOutlook.replace("_", " ")})`,
    },
    ...outlook.topRisks.slice(0, 2).map((risk) => ({
      label: "Risk",
      detail: risk.title,
      severity: "warning" as const,
    })),
    ...outlook.topOpportunities.slice(0, 2).map((opp) => ({
      label: "Opportunity",
      detail: opp.title,
    })),
    ...outlook.biggestBlockers.slice(0, 2).map((blocker) => ({
      label: "Blocker",
      detail: blocker.title,
      severity: "critical" as const,
    })),
  ];

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer("outlook", "Strategic outlook", directAnswer),
    {
      supportingSignals: signals,
      recommendedActions: [
        ...outlook.recommendedFocus,
        ...outlook.projectsToDoubleDown.map(
          (p) => `Double down: ${p.projectName} — ${p.reason}`,
        ),
        ...outlook.projectsToPauseOrReview.map(
          (p) => `Pause/review: ${p.projectName} — ${p.reason}`,
        ),
      ].slice(0, 8),
      relatedProjects: [
        ...outlook.projectsToDoubleDown.map((p) => p.projectId),
        ...outlook.projectsToPauseOrReview.map((p) => p.projectId),
      ],
      confidence: "high",
    },
  );
}

export function buildRiskOpportunityAnswer(
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
  mode: "risk" | "opportunity" = "risk",
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const outlook = generateOctaneOutlook(outlookInputFromState(state), ref);
  const { holdings, monthlyRevenue, monthlyExpenses } = buildPortfolioContext(
    state,
    ref,
  );

  const category = mode;
  const insights =
    mode === "risk" ? outlook.topRisks : outlook.topOpportunities;
  const title = mode === "risk" ? "Risks" : "Opportunities";

  const financeRisk =
    monthlyExpenses > monthlyRevenue
      ? `Burn exceeds revenue (${formatCurrency(monthlyExpenses - monthlyRevenue)} gap).`
      : null;
  const holdingsRisk =
    holdings.score < 60
      ? `Holdings health ${holdings.score}/100 — compliance or IP gaps.`
      : null;

  const directAnswer =
    insights.length > 0
      ? `${title}: ${insights
          .slice(0, 3)
          .map((i) => i.title)
          .join("; ")}. ${mode === "risk" && financeRisk ? financeRisk : ""} ${
          mode === "risk" && holdingsRisk ? holdingsRisk : ""
        }`.trim()
      : mode === "risk"
        ? "No critical risks flagged in outlook heuristics — monitor burn, blockers, and holdings weekly."
        : "No standout opportunities detected — advance high-progress projects and revenue-ready bets.";

  const signals = [
    ...insights.slice(0, 5).map((item) => ({
      label: item.category,
      detail: `${item.title}: ${item.description}`,
      severity:
        item.severity === "critical" || item.severity === "high"
          ? ("warning" as const)
          : ("info" as const),
    })),
    ...(mode === "risk" && financeRisk
      ? [{ label: "Finance", detail: financeRisk, severity: "warning" as const }]
      : []),
    ...(mode === "risk" && holdingsRisk
      ? [{ label: "Holdings", detail: holdingsRisk, severity: "warning" as const }]
      : []),
    ...(mode === "opportunity" && monthlyRevenue > 0
      ? [
          {
            label: "Revenue signal",
            detail: `${formatCurrency(monthlyRevenue)} booked this month.`,
          },
        ]
      : []),
  ];

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer(category, title, directAnswer),
    {
      supportingSignals: signals,
      recommendedActions:
        mode === "risk"
          ? outlook.whatNeedsImprovement.slice(0, 5)
          : [
              ...outlook.whatIsWorking.slice(0, 3),
              ...outlook.projectsToDoubleDown.map(
                (p) => `Invest in ${p.projectName}: ${p.reason}`,
              ),
            ],
      relatedProjects: outlook.projectsToDoubleDown
        .concat(outlook.projectsToPauseOrReview)
        .map((p) => p.projectId),
      confidence: deriveConfidence({
        category,
        signalCount: signals.length,
        hasCoreData: true,
      }),
    },
  );
}

export function buildImprovementAnswer(
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const outlook = generateOctaneOutlook(outlookInputFromState(state), ref);
  const improvements = outlook.whatNeedsImprovement;

  const directAnswer =
    improvements.length > 0
      ? `Top improvement areas: ${improvements.slice(0, 3).join(" ")}`
      : "Operations are balanced — maintain cadence with weekly reviews and roadmap updates.";

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer("improvement", "Improvements", directAnswer),
    {
      supportingSignals: improvements.slice(0, 6).map((detail) => ({
        label: "Improvement",
        detail,
      })),
      recommendedActions: [
        ...improvements,
        ...outlook.recommendedFocus.slice(0, 3),
      ].filter((v, i, arr) => arr.indexOf(v) === i),
      relatedProjects: outlook.projectsToPauseOrReview
        .slice(0, 4)
        .map((p) => p.projectId),
      confidence: deriveConfidence({
        category: "improvement",
        signalCount: improvements.length,
        hasCoreData: true,
      }),
    },
  );
}

export function buildUnknownAnswer(
  state: ExecutiveAnswerInput,
  referenceDate?: Date,
): ExecutiveAnswer {
  const ref = resolveReferenceDate(referenceDate);
  const { briefing, octaneScore } = buildPortfolioContext(state, ref);
  const today = startOfDay(ref);

  const directAnswer = `I could not match a specific executive topic. Portfolio snapshot: Octane score ${octaneScore.score}/100; ${openWorkCounts(state)} Top move: ${briefing.topThreeMoves[0] ?? "review /briefing for priorities."}`;

  return mergeExecutiveAnswer(
    emptyExecutiveAnswer(
      "unknown",
      "Executive summary",
      directAnswer,
      "low",
    ),
    {
      supportingSignals: briefing.topPriorities.slice(0, 4).map((detail) => ({
        label: "Signal",
        detail,
      })),
      recommendedActions: briefing.suggestedActions.slice(0, 4),
      relatedProjects: state.projects
        .filter((p) => isActiveProjectStatus(p.status))
        .slice(0, 4)
        .map((p) => p.id),
      relatedTasks: overdueOpenTasks(state, today)
        .slice(0, 4)
        .map((t) => t.id),
      confidence: "low",
    },
  );
}
