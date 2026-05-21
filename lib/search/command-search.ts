import { mainNavItems } from "@/lib/nav";
import { generateOctaneOutlook } from "@/lib/outlook/generate-octane-outlook";
import type { OctanePersistedState } from "@/lib/store/octane-store";

export type SearchResultType =
  | "page"
  | "executiveShortcut"
  | "outlookInsight"
  | "project"
  | "task"
  | "agent"
  | "transaction"
  | "document"
  | "ipAsset"
  | "decision"
  | "roadmapItem"
  | "entity"
  | "complianceReminder"
  | "legalQuestion"
  | "formationChecklist"
  | "workSession"
  | "inboxItem"
  | "founderNote";

export interface CommandSearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  projectId?: string;
  projectName?: string;
  href: string;
  /** Open detail sheet on target page when supported */
  detailParam?: string;
}

const NAV_PAGES = mainNavItems.map((item) => {
  const slug = item.href.slice(1);
  return {
    id: `page-${slug}`,
    title: item.title,
    description: `Go to ${item.title}`,
    href: item.href,
    keywords: [slug, item.title.toLowerCase()],
  };
});

const EXECUTIVE_SHORTCUTS: {
  id: string;
  title: string;
  description: string;
  href: string;
  keywords: string[];
}[] = [
  {
    id: "exec-ask-octane",
    title: "Ask Octane",
    description: "Executive questions on Outlook",
    href: "/outlook#ask-octane",
    keywords: ["ask", "octane", "executive", "advisor", "question"],
  },
  {
    id: "exec-query",
    title: "Executive Query",
    description: "Strategic portfolio Q&A on Outlook",
    href: "/outlook#ask-octane",
    keywords: ["executive", "query", "strategic", "ceo", "founder"],
  },
  {
    id: "exec-intelligence",
    title: "Company Intelligence",
    description: "Octane Outlook — portfolio strategic view",
    href: "/outlook",
    keywords: [
      "company",
      "intelligence",
      "outlook",
      "portfolio",
      "strategic",
      "snapshot",
    ],
  },
  {
    id: "exec-risks",
    title: "Risks",
    description: "Top portfolio risks from Outlook",
    href: "/outlook",
    keywords: ["risk", "risks", "threat", "downside", "exposure"],
  },
  {
    id: "exec-opportunities",
    title: "Opportunities",
    description: "Top opportunities from Outlook",
    href: "/outlook",
    keywords: ["opportunity", "opportunities", "upside", "bet", "double down"],
  },
  {
    id: "exec-plan",
    title: "30/60/90 Plan",
    description: "Strategic horizons on Outlook",
    href: "/outlook",
    keywords: ["30", "60", "90", "plan", "day", "horizon", "milestone"],
  },
  {
    id: "exec-risk-question",
    title: "What are my top risks?",
    description: "Executive query · risks",
    href: "/outlook#ask-octane",
    keywords: ["what", "top", "risk", "wrong", "threat"],
  },
  {
    id: "exec-focus-question",
    title: "What should I focus on today?",
    description: "Executive query · priorities",
    href: "/outlook#ask-octane",
    keywords: ["focus", "today", "priority", "priorities", "morning"],
  },
  {
    id: "exec-changed-question",
    title: "What changed this week?",
    description: "Executive query · activity",
    href: "/outlook#ask-octane",
    keywords: ["changed", "week", "recent", "activity", "updates"],
  },
  {
    id: "exec-blockers-question",
    title: "What's blocking progress?",
    description: "Executive query · blockers",
    href: "/outlook#ask-octane",
    keywords: ["blocker", "blocking", "blocked", "stuck", "progress"],
  },
];

const INTEGRATION_SHORTCUTS: {
  id: string;
  title: string;
  description: string;
  href: string;
  keywords: string[];
}[] = [
  {
    id: "nav-connections",
    title: "Connections",
    description: "Integration hub — GitHub, Vercel, Supabase",
    href: "/connections",
    keywords: ["connect", "connections", "integration", "oauth", "github", "vercel"],
  },
  {
    id: "nav-actions",
    title: "Actions",
    description: "Pending approvals from Octane Chat",
    href: "/actions",
    keywords: ["actions", "approval", "approve", "pending", "proposed"],
  },
  {
    id: "nav-coding",
    title: "Coding",
    description: "GitHub coding workbench — plan, approve, open PR",
    href: "/coding",
    keywords: ["coding", "github", "pr", "pull request", "codex", "workbench"],
  },
  {
    id: "connect-github",
    title: "Connect GitHub",
    description: "Propose GitHub connection (OAuth placeholder)",
    href: "/connections",
    keywords: ["github", "repo", "connect github"],
  },
  {
    id: "connect-vercel",
    title: "Connect Vercel",
    description: "Propose Vercel connection (OAuth placeholder)",
    href: "/connections",
    keywords: ["vercel", "deploy", "connect vercel"],
  },
  {
    id: "ask-setup",
    title: "Ask Octane setup",
    description: "Chat-first workspace setup on Outlook",
    href: "/outlook#ask-octane",
    keywords: ["setup", "onboard", "onboarding", "ask octane setup"],
  },
];

const TYPE_LABELS: Record<SearchResultType, string> = {
  page: "Page",
  executiveShortcut: "Executive",
  outlookInsight: "Outlook",
  project: "Project",
  task: "Task",
  agent: "Agent",
  transaction: "Transaction",
  document: "Document",
  ipAsset: "IP Asset",
  decision: "Decision",
  roadmapItem: "Roadmap",
  entity: "Entity",
  complianceReminder: "Compliance",
  legalQuestion: "Legal Question",
  formationChecklist: "Formation",
  workSession: "Work Session",
  inboxItem: "Inbox",
  founderNote: "Founder Note",
};

export function getSearchResultTypeLabel(type: SearchResultType): string {
  return TYPE_LABELS[type];
}

function projectNameMap(projects: OctanePersistedState["projects"]) {
  return new Map(projects.map((p) => [p.id, p.name]));
}

function matchesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

export function searchCommandIndex(
  state: OctanePersistedState,
  rawQuery: string,
): CommandSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const projectNames = projectNameMap(state.projects);
  const results: CommandSearchResult[] = [];

  for (const page of NAV_PAGES) {
    const haystack = [page.title, page.description, ...page.keywords]
      .join(" ")
      .toLowerCase();
    if (matchesQuery(haystack, query) || matchesQuery(page.title, query)) {
      results.push({
        id: page.id,
        type: "page",
        title: page.title,
        description: page.description,
        href: page.href,
      });
    }
  }

  for (const shortcut of [...EXECUTIVE_SHORTCUTS, ...INTEGRATION_SHORTCUTS]) {
    const haystack = [
      shortcut.title,
      shortcut.description,
      ...shortcut.keywords,
    ]
      .join(" ")
      .toLowerCase();
    if (matchesQuery(haystack, query) || matchesQuery(shortcut.title, query)) {
      results.push({
        id: shortcut.id,
        type: "executiveShortcut",
        title: shortcut.title,
        description: shortcut.description,
        href: shortcut.href,
      });
    }
  }

  const pendingCount = state.octaneActions?.filter((a) => a.status === "pending")
    .length ?? 0;
  if (
    pendingCount > 0 &&
    (matchesQuery("pending approvals actions", query) ||
      matchesQuery("approval", query))
  ) {
    results.push({
      id: "pending-approvals",
      type: "executiveShortcut",
      title: `Pending approvals (${pendingCount})`,
      description: "Review proposed Octane actions",
      href: "/actions",
    });
  }

  const push = (result: CommandSearchResult) => {
    const haystack = [
      result.title,
      result.description,
      result.projectName ?? "",
      getSearchResultTypeLabel(result.type),
    ]
      .join(" ")
      .toLowerCase();
    if (matchesQuery(haystack, query) || matchesQuery(result.title, query)) {
      results.push(result);
    }
  };

  for (const project of state.projects) {
    push({
      id: project.id,
      type: "project",
      title: project.name,
      description: project.description,
      projectId: project.id,
      projectName: project.name,
      href: "/projects",
      detailParam: project.id,
    });
  }

  for (const task of state.tasks) {
    const projectName = projectNames.get(task.projectId);
    push({
      id: task.id,
      type: "task",
      title: task.title,
      description: task.description || `${task.status} · ${task.priority}`,
      projectId: task.projectId,
      projectName,
      href: "/tasks",
      detailParam: task.id,
    });
  }

  for (const agent of state.agents) {
    const projectName = agent.assignedProjectId
      ? projectNames.get(agent.assignedProjectId)
      : undefined;
    push({
      id: agent.id,
      type: "agent",
      title: agent.name,
      description: agent.purpose,
      projectId: agent.assignedProjectId,
      projectName,
      href: "/agents",
      detailParam: agent.id,
    });
  }

  for (const txn of state.transactions) {
    const projectName = txn.projectId
      ? projectNames.get(txn.projectId)
      : undefined;
    push({
      id: txn.id,
      type: "transaction",
      title: `${txn.type} · ${txn.category}`,
      description: txn.notes || `$${txn.amount}`,
      projectId: txn.projectId,
      projectName,
      href: "/finance",
    });
  }

  for (const doc of state.documents) {
    const projectName = doc.projectId
      ? projectNames.get(doc.projectId)
      : undefined;
    push({
      id: doc.id,
      type: "document",
      title: doc.name,
      description: `${doc.category} · ${doc.status}`,
      projectId: doc.projectId,
      projectName,
      href: "/documents",
      detailParam: doc.id,
    });
  }

  for (const asset of state.ipAssets) {
    const projectName = asset.projectId
      ? projectNames.get(asset.projectId)
      : undefined;
    push({
      id: asset.id,
      type: "ipAsset",
      title: asset.name,
      description: `${asset.type} · ${asset.protectionStatus}`,
      projectId: asset.projectId,
      projectName,
      href: "/holdings",
      detailParam: asset.id,
    });
  }

  for (const decision of state.decisions) {
    const projectName = decision.projectId
      ? projectNames.get(decision.projectId)
      : undefined;
    push({
      id: decision.id,
      type: "decision",
      title: decision.title,
      description: decision.summary,
      projectId: decision.projectId,
      projectName,
      href: "/decisions",
      detailParam: decision.id,
    });
  }

  for (const item of state.roadmapItems) {
    const projectName = item.projectId
      ? projectNames.get(item.projectId)
      : undefined;
    push({
      id: item.id,
      type: "roadmapItem",
      title: item.title,
      description: item.description,
      projectId: item.projectId,
      projectName,
      href: "/roadmap",
      detailParam: item.id,
    });
  }

  for (const entity of state.entities) {
    push({
      id: entity.id,
      type: "entity",
      title: entity.name,
      description: `${entity.type} · ${entity.status}`,
      href: "/holdings",
      detailParam: entity.id,
    });
  }

  for (const reminder of state.complianceReminders) {
    push({
      id: reminder.id,
      type: "complianceReminder",
      title: reminder.title,
      description: `${reminder.category} · due ${reminder.dueDate}`,
      projectId: reminder.projectId,
      projectName: reminder.projectId
        ? projectNames.get(reminder.projectId)
        : undefined,
      href: "/holdings",
      detailParam: reminder.id,
    });
  }

  for (const question of state.legalQuestions) {
    const projectName = question.projectId
      ? projectNames.get(question.projectId)
      : undefined;
    push({
      id: question.id,
      type: "legalQuestion",
      title: question.question.slice(0, 80),
      description: `${question.priority} · ${question.status}`,
      projectId: question.projectId,
      projectName,
      href: "/holdings",
      detailParam: question.id,
    });
  }

  for (const item of state.formationChecklistItems) {
    push({
      id: item.id,
      type: "formationChecklist",
      title: item.title,
      description: item.status,
      href: "/holdings",
      detailParam: item.id,
    });
  }

  for (const session of state.workSessions) {
    const projectName = session.projectId
      ? projectNames.get(session.projectId)
      : undefined;
    push({
      id: session.id,
      type: "workSession",
      title: session.title,
      description:
        session.outcome ||
        session.notes ||
        `${session.status}${session.durationMinutes ? ` · ${session.durationMinutes}m` : ""}`,
      projectId: session.projectId,
      projectName,
      href: "/today",
      detailParam: session.id,
    });
  }

  for (const inboxItem of state.inboxItems) {
    const projectName = inboxItem.linkedProjectId
      ? projectNames.get(inboxItem.linkedProjectId)
      : undefined;
    push({
      id: inboxItem.id,
      type: "inboxItem",
      title: inboxItem.title,
      description: inboxItem.body || `${inboxItem.type} · ${inboxItem.status}`,
      projectId: inboxItem.linkedProjectId,
      projectName,
      href: "/inbox",
      detailParam: inboxItem.id,
    });
  }

  for (const note of state.founderNotes) {
    const projectName = note.linkedProjectId
      ? projectNames.get(note.linkedProjectId)
      : undefined;
    push({
      id: note.id,
      type: "founderNote",
      title: note.title,
      description: note.body.slice(0, 120) || note.tags.join(", "),
      projectId: note.linkedProjectId,
      projectName,
      href: "/notes",
      detailParam: note.id,
    });
  }

  if (state.projects.length > 0) {
    const outlook = generateOctaneOutlook(state);
    const outlookItems: {
      kind: string;
      item: { id: string; title: string; description: string };
    }[] = [
      ...outlook.topRisks.map((r) => ({ kind: "risk", item: r })),
      ...outlook.topOpportunities.map((o) => ({ kind: "opportunity", item: o })),
      ...outlook.recommendedFocus.map((focus, i) => ({
        kind: "focus",
        item: {
          id: `focus-${i}`,
          title: focus,
          description: "Recommended focus · Outlook",
        },
      })),
      ...outlook["30DayPlan"].milestones.map((m, i) => ({
        kind: "30-day",
        item: {
          id: `30d-${i}`,
          title: m,
          description: `30-day · ${outlook["30DayPlan"].theme}`,
        },
      })),
      ...outlook["60DayPlan"].milestones.map((m, i) => ({
        kind: "60-day",
        item: {
          id: `60d-${i}`,
          title: m,
          description: `60-day · ${outlook["60DayPlan"].theme}`,
        },
      })),
      ...outlook["90DayPlan"].milestones.map((m, i) => ({
        kind: "90-day",
        item: {
          id: `90d-${i}`,
          title: m,
          description: `90-day · ${outlook["90DayPlan"].theme}`,
        },
      })),
    ];
    for (const { kind, item } of outlookItems) {
      push({
        id: `outlook-${kind}-${item.id}`,
        type: "outlookInsight",
        title: item.title,
        description: item.description,
        href: "/outlook",
      });
    }
  }

  return results.slice(0, 50);
}

export function groupSearchResults(
  results: CommandSearchResult[],
): Record<SearchResultType, CommandSearchResult[]> {
  const grouped: Record<SearchResultType, CommandSearchResult[]> = {
    page: [],
    executiveShortcut: [],
    outlookInsight: [],
    project: [],
    task: [],
    agent: [],
    transaction: [],
    document: [],
    ipAsset: [],
    decision: [],
    roadmapItem: [],
    entity: [],
    complianceReminder: [],
    legalQuestion: [],
    formationChecklist: [],
    workSession: [],
    inboxItem: [],
    founderNote: [],
  };
  for (const result of results) {
    grouped[result.type].push(result);
  }
  return grouped;
}
