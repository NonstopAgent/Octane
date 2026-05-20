import { getRepoBlobPaths } from "@/lib/integrations/github-client";

const MAX_FILES = 5;

type KeywordRule = {
  keywords: string[];
  paths: string[];
  weight?: number;
};

/** Keyword → likely paths for Octane modules (scored against repo tree). */
const KEYWORD_RULES: KeywordRule[] = [
  {
    keywords: ["outlook", "ask octane", "ask-octane", "strategic"],
    paths: [
      "app/(app)/outlook",
      "components/modules/outlook",
      "lib/executive",
    ],
  },
  {
    keywords: ["coding", "workbench", "coding job", "pull request", "github pr"],
    paths: [
      "app/(app)/coding",
      "components/modules/coding",
      "lib/coding",
      "app/api/coding",
    ],
  },
  {
    keywords: ["connection", "vercel", "github", "integration", "deploy"],
    paths: [
      "app/(app)/connections",
      "lib/integrations",
      "app/api/integrations",
    ],
  },
  {
    keywords: ["dashboard", "metrics", "octane score"],
    paths: ["app/(app)/dashboard", "components/modules/dashboard"],
  },
  {
    keywords: ["chat", "advisor", "briefing"],
    paths: ["app/(app)/chat", "app/(app)/briefing", "lib/advisor"],
  },
  {
    keywords: ["project", "projects"],
    paths: ["app/(app)/projects", "components/modules/projects"],
  },
  {
    keywords: ["action", "approval"],
    paths: ["app/(app)/actions", "lib/actions"],
  },
];

const FALLBACK_CANDIDATES = [
  "README.md",
  "app/(app)/dashboard/page.tsx",
  "app/(app)/connections/page.tsx",
  "app/(app)/coding/page.tsx",
  "components/modules/coding/coding-job-card.tsx",
];

function scorePath(path: string, promptLower: string): number {
  let score = 0;
  const pathLower = path.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    const hit = rule.keywords.some((k) => promptLower.includes(k));
    if (!hit) continue;
    for (const prefix of rule.paths) {
      if (pathLower.includes(prefix.toLowerCase().replace(/\\/g, "/"))) {
        score += rule.weight ?? 10;
      }
    }
  }
  if (/\.(tsx|ts|jsx|js|md)$/.test(path)) score += 1;
  if (path.includes("node_modules") || path.startsWith(".")) score -= 100;
  if (path.includes(".env")) score -= 200;
  return score;
}

export type DiscoverSourceFilesResult = {
  files: string[];
  branch?: string;
  configured: boolean;
  message?: string;
};

/**
 * Discover up to 5 repo paths relevant to the job prompt (read-only tree).
 */
export async function discoverSourceFiles(
  repo: string,
  prompt: string,
): Promise<DiscoverSourceFilesResult> {
  const { configured, paths, branch } = await getRepoBlobPaths(repo);
  if (!configured) {
    return {
      files: FALLBACK_CANDIDATES.slice(0, MAX_FILES),
      configured: false,
      message: "GITHUB_TOKEN not configured — using fallback paths",
    };
  }

  const promptLower = prompt.toLowerCase();
  const pathSet = new Set(paths);

  const ranked = paths
    .map((path) => ({ path, score: scorePath(path, promptLower) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const picked: string[] = [];
  for (const { path } of ranked) {
    if (picked.length >= MAX_FILES) break;
    if (!picked.includes(path)) picked.push(path);
  }

  for (const candidate of FALLBACK_CANDIDATES) {
    if (picked.length >= MAX_FILES) break;
    if (pathSet.has(candidate) && !picked.includes(candidate)) {
      picked.push(candidate);
    }
  }

  if (picked.length === 0 && paths.length > 0) {
    const shallow = paths
      .filter(
        (p) =>
          /\.(tsx|ts)$/.test(p) &&
          !p.includes("node_modules") &&
          p.split("/").length <= 4,
      )
      .slice(0, MAX_FILES);
    picked.push(...shallow);
  }

  return {
    files: picked.slice(0, MAX_FILES),
    branch,
    configured: true,
  };
}

export const MAX_SOURCE_EDIT_FILES = MAX_FILES;
