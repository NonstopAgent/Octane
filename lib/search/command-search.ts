import type { OctanePersistedState } from "@/lib/store/octane-store";

export type SearchResultType =
  | "project"
  | "task"
  | "agent"
  | "transaction"
  | "document"
  | "ipAsset"
  | "decision"
  | "roadmapItem"
  | "entity";

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

const TYPE_LABELS: Record<SearchResultType, string> = {
  project: "Project",
  task: "Task",
  agent: "Agent",
  transaction: "Transaction",
  document: "Document",
  ipAsset: "IP Asset",
  decision: "Decision",
  roadmapItem: "Roadmap",
  entity: "Entity",
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
      href: "/documents",
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
    });
  }

  for (const entity of state.entities) {
    push({
      id: entity.id,
      type: "entity",
      title: entity.name,
      description: `${entity.type} · ${entity.status}`,
      href: "/settings",
    });
  }

  return results.slice(0, 50);
}

export function groupSearchResults(
  results: CommandSearchResult[],
): Record<SearchResultType, CommandSearchResult[]> {
  const grouped: Record<SearchResultType, CommandSearchResult[]> = {
    project: [],
    task: [],
    agent: [],
    transaction: [],
    document: [],
    ipAsset: [],
    decision: [],
    roadmapItem: [],
    entity: [],
  };
  for (const result of results) {
    grouped[result.type].push(result);
  }
  return grouped;
}
