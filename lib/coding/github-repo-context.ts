import type { ProjectConnection } from "@/lib/types/project-connection";

const REPO_PATTERN = /([\w.-]+\/[\w.-]+)/;

export function getLinkedGithubRepos(
  projectConnections: ProjectConnection[],
): string[] {
  const repos = projectConnections
    .filter((pc) => pc.kind === "github" && pc.repo)
    .map((pc) => pc.repo as string);
  return [...new Set(repos)];
}

export function getGithubRepoForProject(
  projectConnections: ProjectConnection[],
  projectId: string,
): string | undefined {
  return projectConnections.find(
    (pc) => pc.projectId === projectId && pc.kind === "github" && pc.repo,
  )?.repo;
}

export function inferRepoFromText(text: string): string | undefined {
  const match = text.match(REPO_PATTERN);
  return match?.[1];
}

export function inferProjectIdFromText(
  text: string,
  projects: { id: string; name: string }[],
): string | undefined {
  const lower = text.toLowerCase();
  for (const project of projects) {
    if (lower.includes(project.name.toLowerCase())) {
      return project.id;
    }
  }
  return undefined;
}

export type ResolveCodingRepoInput = {
  text: string;
  projectId?: string;
  projectConnections: ProjectConnection[];
  projects: { id: string; name: string }[];
};

/** Resolve repo + project for a coding intent from text, selection, and links. */
export function resolveCodingRepo(input: ResolveCodingRepoInput): {
  repo?: string;
  projectId?: string;
} {
  const fromText = inferRepoFromText(input.text);
  const projectId =
    input.projectId ??
    inferProjectIdFromText(input.text, input.projects);
  const fromProject =
    projectId != null
      ? getGithubRepoForProject(input.projectConnections, projectId)
      : undefined;
  const linked = getLinkedGithubRepos(input.projectConnections);
  const singleRepo = linked.length === 1 ? linked[0] : undefined;

  return {
    repo: fromText ?? fromProject ?? singleRepo,
    projectId,
  };
}
