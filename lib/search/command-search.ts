import { mainNavItems } from "@/lib/nav";
import type { OctanePersistedState } from "@/lib/store/octane-store";

export type SearchResultType =
  | "page"
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

const TYPE_LABELS: Record<SearchResultType, string> = {
  page: "Page",
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

  return results.slice(0, 50);
}

export function groupSearchResults(
  results: CommandSearchResult[],
): Record<SearchResultType, CommandSearchResult[]> {
  const grouped: Record<SearchResultType, CommandSearchResult[]> = {
    page: [],
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
