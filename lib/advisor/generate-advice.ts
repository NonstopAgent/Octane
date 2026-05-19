import {
  differenceInCalendarDays,
  isBefore,
  isToday,
  parseISO,
  startOfDay,
} from "date-fns";

import {
  getMonthlyExpenses,
  getMonthlyRevenue,
  isPendingDecisionStatus,
  isProjectStale,
} from "@/lib/dashboard/metrics";
import {
  countOpenLegalQuestions,
  countOverdueComplianceReminders,
  formationChecklistProgress,
} from "@/lib/holdings/metrics";
import { computeHoldingsHealth } from "@/lib/scoring/holdings-health";
import type { OctanePersistedState } from "@/lib/store/octane-store";

export interface AdvisorInsight {
  id: string;
  category: "execution" | "finance" | "ownership" | "decisions" | "agents" | "focus";
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  body: string;
  action?: string;
  actionHref?: string;
}

export interface AdvisorResponse {
  headline: string;
  insights: AdvisorInsight[];
  suggestedPrompts: string[];
}

const SUGGESTED_PROMPTS = [
  "What should I focus on today?",
  "What is blocking Octane right now?",
  "Where am I spending money without revenue?",
  "Which project deserves the most attention?",
  "What legal/ownership questions need review?",
];

function insightId(category: string, key: string): string {
  return `${category}-${key}`;
}

export function generateAdvice(
  state: OctanePersistedState,
  referenceDate: Date = new Date(),
): AdvisorResponse {
  const today = startOfDay(referenceDate);
  const insights: AdvisorInsight[] = [];

  // --- Agents: error state ---
  const errorAgents = state.agents.filter((a) => a.status === "error");
  if (errorAgents.length > 0) {
    const names = errorAgents.map((a) => a.name).join(", ");
    insights.push({
      id: insightId("agents", "error"),
      category: "agents",
      priority: "critical",
      title: `${errorAgents.length} agent${errorAgents.length === 1 ? "" : "s"} in error state`,
      body: `The following agent${errorAgents.length === 1 ? " is" : "s are"} reporting errors and may have halted automated work: ${names}. Investigate and restart or reassign tasks.`,
      action: "Review /agents",
      actionHref: "/agents",
    });
  }

  // --- Tasks: blocked critical/high ---
  const blockedHighTasks = state.tasks.filter(
    (t) =>
      t.status === "blocked" &&
      (t.priority === "critical" || t.priority === "high"),
  );
  if (blockedHighTasks.length > 0) {
    const titles = blockedHighTasks
      .slice(0, 3)
      .map((t) => t.title)
      .join(", ");
    insights.push({
      id: insightId("execution", "blocked-critical"),
      category: "execution",
      priority: "high",
      title: `${blockedHighTasks.length} critical/high task${blockedHighTasks.length === 1 ? "" : "s"} are blocked`,
      body: `High-priority work is stopped. Tasks blocked: ${titles}${blockedHighTasks.length > 3 ? ` and ${blockedHighTasks.length - 3} more` : ""}. Remove blockers or escalate to keep momentum.`,
      action: "Open /tasks",
      actionHref: "/tasks",
    });
  }

  // --- Tasks: overdue ---
  const overdueTasks = state.tasks.filter((t) => {
    if (t.status === "done" || !t.dueDate) return false;
    return isBefore(startOfDay(parseISO(t.dueDate)), today);
  });
  if (overdueTasks.length > 0) {
    const oldest = [...overdueTasks].sort(
      (a, b) =>
        new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
    )[0];
    const daysLate = differenceInCalendarDays(
      today,
      startOfDay(parseISO(oldest.dueDate!)),
    );
    insights.push({
      id: insightId("execution", "overdue"),
      category: "execution",
      priority: "high",
      title: `${overdueTasks.length} overdue task${overdueTasks.length === 1 ? "" : "s"}`,
      body: `You have ${overdueTasks.length} task${overdueTasks.length === 1 ? "" : "s"} past due. The oldest is "${oldest.title}", now ${daysLate} day${daysLate === 1 ? "" : "s"} late. Renegotiate dates or clear these first.`,
      action: "Open /tasks",
      actionHref: "/tasks",
    });
  }

  // --- Decisions: review date <= today ---
  const decisionsDue = state.decisions.filter((d) => {
    if (!d.reviewDate || !isPendingDecisionStatus(d.status)) return false;
    return startOfDay(parseISO(d.reviewDate)) <= today;
  });
  if (decisionsDue.length > 0) {
    insights.push({
      id: insightId("decisions", "review-due"),
      category: "decisions",
      priority: "medium",
      title: `${decisionsDue.length} decision${decisionsDue.length === 1 ? "" : "s"} due for review`,
      body: `${decisionsDue.length === 1 ? `"${decisionsDue[0].title}" is` : `${decisionsDue.length} decisions are`} at or past their scheduled review date. Revisit, update, or close them.`,
      action: "Open /decisions",
      actionHref: "/decisions",
    });
  }

  // --- Finance: expenses > revenue ---
  const monthlyRevenue = getMonthlyRevenue(state.transactions, referenceDate);
  const monthlyExpenses = getMonthlyExpenses(state.transactions, referenceDate);
  if (monthlyExpenses > monthlyRevenue) {
    const gap = monthlyExpenses - monthlyRevenue;
    const fmt = (n: number) =>
      n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
    insights.push({
      id: insightId("finance", "burn-exceeds-revenue"),
      category: "finance",
      priority: "high",
      title: "Monthly burn exceeds revenue",
      body: `You are spending ${fmt(monthlyExpenses)} against ${fmt(monthlyRevenue)} in revenue this month — a ${fmt(gap)} deficit. Review spend allocation and revenue pipeline.`,
      action: "Open /finance",
      actionHref: "/finance",
    });
  }

  // --- Projects: stale high-priority (no update in 7+ days) ---
  const staleHighPriorityProjects = state.projects.filter(
    (p) =>
      (p.priority === "high" || p.priority === "critical") &&
      p.status !== "killed" &&
      p.status !== "paused" &&
      isProjectStale(p, referenceDate),
  );
  if (staleHighPriorityProjects.length > 0) {
    const names = staleHighPriorityProjects
      .slice(0, 2)
      .map((p) => p.name)
      .join(", ");
    insights.push({
      id: insightId("execution", "stale-projects"),
      category: "execution",
      priority: "medium",
      title: `${staleHighPriorityProjects.length} high-priority project${staleHighPriorityProjects.length === 1 ? "" : "s"} without recent updates`,
      body: `${names}${staleHighPriorityProjects.length > 2 ? ` and ${staleHighPriorityProjects.length - 2} more` : ""} ${staleHighPriorityProjects.length === 1 ? "has" : "have"} not been updated in 7+ days. Check for blockers or update progress.`,
      action: "Open /projects",
      actionHref: "/projects",
    });
  }

  // --- Holdings: compliance reminders overdue ---
  const overdueCompliance = countOverdueComplianceReminders(
    state.complianceReminders,
    referenceDate,
  );
  if (overdueCompliance > 0) {
    insights.push({
      id: insightId("ownership", "compliance-overdue"),
      category: "ownership",
      priority: "high",
      title: `${overdueCompliance} overdue compliance reminder${overdueCompliance === 1 ? "" : "s"}`,
      body: `${overdueCompliance} compliance deadline${overdueCompliance === 1 ? " has" : "s have"} passed without completion. Missed filings or renewals can create legal or financial risk.`,
      action: "Open /holdings",
      actionHref: "/holdings",
    });
  }

  // --- Holdings: open critical legal questions ---
  const openLegalCount = countOpenLegalQuestions(state.legalQuestions);
  const criticalLegalQuestions = state.legalQuestions.filter(
    (q) => q.status === "open" && q.priority === "high",
  );
  if (criticalLegalQuestions.length > 0) {
    insights.push({
      id: insightId("ownership", "legal-questions"),
      category: "ownership",
      priority: "medium",
      title: `${criticalLegalQuestions.length} critical legal question${criticalLegalQuestions.length === 1 ? "" : "s"} open`,
      body: `You have ${criticalLegalQuestions.length} high-priority legal question${criticalLegalQuestions.length === 1 ? "" : "s"} without answers${openLegalCount > criticalLegalQuestions.length ? ` (${openLegalCount} open total)` : ""}. Consult counsel or research and close them.`,
      action: "Open /holdings",
      actionHref: "/holdings",
    });
  } else if (openLegalCount > 0) {
    insights.push({
      id: insightId("ownership", "legal-questions-low"),
      category: "ownership",
      priority: "medium",
      title: `${openLegalCount} open legal question${openLegalCount === 1 ? "" : "s"}`,
      body: `${openLegalCount} legal question${openLegalCount === 1 ? " remains" : "s remain"} unresolved. Review and close or defer with your advisor.`,
      action: "Open /holdings",
      actionHref: "/holdings",
    });
  }

  // --- Holdings: formation checklist < 30% ---
  const { done: checklistDone, total: checklistTotal } =
    formationChecklistProgress(state.formationChecklistItems);
  const checklistPct =
    checklistTotal === 0 ? 100 : (checklistDone / checklistTotal) * 100;
  if (checklistTotal > 0 && checklistPct < 30) {
    insights.push({
      id: insightId("ownership", "formation-early"),
      category: "ownership",
      priority: "low",
      title: "Holdings setup is early",
      body: `Formation checklist is only ${Math.round(checklistPct)}% complete (${checklistDone}/${checklistTotal} items done). Complete formation steps to establish proper legal and operational structure.`,
      action: "Open /holdings",
      actionHref: "/holdings",
    });
  }

  // --- Holdings: health score < 50 ---
  const holdingsHealth = computeHoldingsHealth(state, referenceDate);
  if (holdingsHealth.score < 50) {
    insights.push({
      id: insightId("ownership", "holdings-health"),
      category: "ownership",
      priority: "medium",
      title: `Holdings health at ${holdingsHealth.score}/100`,
      body:
        holdingsHealth.suggestions.length > 0
          ? `Your legal and ownership structure needs attention. Top suggestion: ${holdingsHealth.suggestions[0]}`
          : "Your holdings health score is below 50. Review entity structure, IP ownership, and compliance status.",
      action: "Open /holdings",
      actionHref: "/holdings",
    });
  }

  // --- Focus: no work session started today ---
  const hasWorkSessionToday = state.workSessions.some((s) =>
    isToday(parseISO(s.startedAt)),
  );
  if (!hasWorkSessionToday) {
    insights.push({
      id: insightId("focus", "no-session-today"),
      category: "focus",
      priority: "low",
      title: "No work session started yet",
      body: "You haven't logged a work session today. Starting one helps track focus time and ties completed work to projects and tasks.",
      action: "Start session in /today",
      actionHref: "/today",
    });
  }

  // --- Headline ---
  const criticalOrHighCount = insights.filter(
    (i) => i.priority === "critical" || i.priority === "high",
  ).length;

  let headline: string;
  if (criticalOrHighCount === 0) {
    headline = "Everything looks on track";
  } else if (criticalOrHighCount <= 2) {
    headline = "A couple things need attention";
  } else {
    headline = `${criticalOrHighCount} things need your attention`;
  }

  // Sort by priority
  const priorityOrder: Record<AdvisorInsight["priority"], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  const sortedInsights = [...insights].sort(
    (a, b) => priorityOrder[b.priority] - priorityOrder[a.priority],
  );

  return {
    headline,
    insights: sortedInsights,
    suggestedPrompts: SUGGESTED_PROMPTS,
  };
}

/**
 * Given a prompt string, return a focused paragraph answer derived from the
 * insights. No external AI calls — purely deterministic.
 */
export function answerPrompt(
  prompt: string,
  response: AdvisorResponse,
): string {
  const lower = prompt.toLowerCase();

  // "focus today" / "what should I focus"
  if (lower.includes("focus") && !lower.includes("legal")) {
    const focusInsights = response.insights.filter((i) =>
      ["execution", "focus", "agents"].includes(i.category),
    );
    if (focusInsights.length === 0) {
      return "Your execution queue is clear. Focus on advancing the highest-priority in-progress work and logging a work session to stay intentional.";
    }
    const top = focusInsights.slice(0, 3);
    return `Today's focus should be driven by ${top.length} key item${top.length === 1 ? "" : "s"}: ${top.map((i) => i.title.toLowerCase()).join("; ")}. ${top[0].body}`;
  }

  // "blocking" / "blocked"
  if (lower.includes("block")) {
    const blockedInsights = response.insights.filter(
      (i) => i.category === "execution" && i.id.includes("blocked"),
    );
    if (blockedInsights.length === 0) {
      return "Nothing is currently blocked at critical or high priority. Your execution pipeline is flowing — check /tasks for any medium/low blockers.";
    }
    return blockedInsights.map((i) => i.body).join(" ");
  }

  // "money" / "spending" / "revenue"
  if (
    lower.includes("money") ||
    lower.includes("spending") ||
    lower.includes("revenue") ||
    lower.includes("spend")
  ) {
    const financeInsights = response.insights.filter(
      (i) => i.category === "finance",
    );
    if (financeInsights.length === 0) {
      return "Monthly expenses appear to be within revenue for this period. No burn-alert conditions detected — check /finance for a full breakdown by project.";
    }
    return financeInsights.map((i) => i.body).join(" ");
  }

  // "project" / "attention"
  if (lower.includes("project") || lower.includes("attention")) {
    const projectInsights = response.insights.filter(
      (i) => i.category === "execution" || i.priority === "critical",
    );
    if (projectInsights.length === 0) {
      return "All high-priority projects appear active and recently updated. Review /projects for a full status board.";
    }
    const top = projectInsights[0];
    return `The highest-leverage project area right now is: ${top.title}. ${top.body}${projectInsights.length > 1 ? ` There ${projectInsights.length - 1 === 1 ? "is" : "are"} ${projectInsights.length - 1} other execution item${projectInsights.length - 1 === 1 ? "" : "s"} to address.` : ""}`;
  }

  // "legal" / "ownership" / "questions"
  if (
    lower.includes("legal") ||
    lower.includes("ownership") ||
    lower.includes("question")
  ) {
    const ownershipInsights = response.insights.filter(
      (i) => i.category === "ownership" || i.category === "decisions",
    );
    if (ownershipInsights.length === 0) {
      return "No open legal questions or ownership gaps were detected. Your holdings structure appears clean — review /holdings for the full compliance calendar.";
    }
    return ownershipInsights.map((i) => i.body).join(" ");
  }

  // Fallback: all insights
  if (response.insights.length === 0) {
    return "No urgent items detected across your portfolio. Operations appear stable.";
  }
  const top = response.insights.slice(0, 3);
  return `Key items across your portfolio: ${top.map((i) => `${i.title} — ${i.body}`).join(" | ")}`;
}
