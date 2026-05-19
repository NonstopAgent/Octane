import { fetchWithTimeout } from "@/lib/integrations/http";
import type {
  GitHubCommitSummary,
  GitHubIssueSummary,
  GitHubPullRequestSummary,
  GitHubRepoDetail,
  GitHubRepoSummary,
  IntegrationAuthStatus,
} from "@/lib/integrations/types";

const GITHUB_API = "https://api.github.com";

function checkedAt(): string {
  return new Date().toISOString();
}

function githubHeaders(): Record<string, string> | null {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return null;
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubGet<T>(path: string): Promise<T | null> {
  const headers = githubHeaders();
  if (!headers) return null;
  const res = await fetchWithTimeout(`${GITHUB_API}${path}`, { headers });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function mapRepo(raw: {
  full_name: string;
  name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  open_issues_count: number;
  stargazers_count: number;
  pushed_at: string | null;
  html_url: string;
  forks_count?: number;
  language?: string | null;
  visibility?: string;
}): GitHubRepoDetail {
  return {
    fullName: raw.full_name,
    name: raw.name,
    description: raw.description,
    private: raw.private,
    defaultBranch: raw.default_branch,
    openIssues: raw.open_issues_count,
    stars: raw.stargazers_count,
    pushedAt: raw.pushed_at,
    url: raw.html_url,
    forks: raw.forks_count ?? 0,
    language: raw.language ?? null,
    visibility: raw.visibility ?? (raw.private ? "private" : "public"),
  };
}

export async function getAuthenticatedStatus(): Promise<IntegrationAuthStatus> {
  const at = checkedAt();
  const headers = githubHeaders();
  if (!headers) {
    return {
      provider: "github",
      configured: false,
      connected: false,
      message: "GITHUB_TOKEN not configured on server",
      checkedAt: at,
    };
  }

  const user = await githubGet<{ login: string; name: string | null }>("/user");
  if (!user) {
    return {
      provider: "github",
      configured: true,
      connected: false,
      message: "GitHub token invalid or API unreachable",
      checkedAt: at,
    };
  }

  return {
    provider: "github",
    configured: true,
    connected: true,
    login: user.login,
    name: user.name ?? user.login,
    checkedAt: at,
  };
}

export async function listRepos(limit = 30): Promise<{
  configured: boolean;
  repos: GitHubRepoSummary[];
}> {
  const headers = githubHeaders();
  if (!headers) {
    return { configured: false, repos: [] };
  }

  const data = await githubGet<
    {
      full_name: string;
      name: string;
      description: string | null;
      private: boolean;
      default_branch: string;
      open_issues_count: number;
      stargazers_count: number;
      pushed_at: string | null;
      html_url: string;
    }[]
  >(`/user/repos?per_page=${Math.min(limit, 100)}&sort=updated`);

  return {
    configured: true,
    repos: (data ?? []).map((r) => mapRepo(r)),
  };
}

export async function getRepo(fullName: string): Promise<GitHubRepoDetail | null> {
  const encoded = fullName
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const raw = await githubGet<Parameters<typeof mapRepo>[0]>(`/repos/${encoded}`);
  return raw ? mapRepo(raw) : null;
}

export async function getRepoSummary(
  fullName: string,
): Promise<(GitHubRepoSummary & { latestCommit: GitHubCommitSummary | null }) | null> {
  const repo = await getRepo(fullName);
  if (!repo) return null;
  const commits = await getRecentCommits(fullName, 1);
  return {
    ...repo,
    latestCommit: commits[0] ?? null,
  };
}

export async function getRecentCommits(
  fullName: string,
  perPage = 5,
): Promise<GitHubCommitSummary[]> {
  const encoded = fullName
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const data = await githubGet<
    {
      sha: string;
      html_url: string;
      commit: { message: string; author: { name: string; date: string } };
    }[]
  >(`/repos/${encoded}/commits?per_page=${perPage}`);

  return (data ?? []).map((c) => ({
    sha: c.sha,
    shortSha: c.sha.slice(0, 7),
    message: c.commit.message.split("\n")[0] ?? "",
    author: c.commit.author.name,
    date: c.commit.author.date,
    url: c.html_url,
  }));
}

export async function getOpenIssues(
  fullName: string,
  perPage = 10,
): Promise<GitHubIssueSummary[]> {
  const encoded = fullName
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const data = await githubGet<
    {
      number: number;
      title: string;
      html_url: string;
      user: { login: string };
      labels: { name: string }[];
      created_at: string;
      pull_request?: unknown;
    }[]
  >(`/repos/${encoded}/issues?state=open&per_page=${perPage}`);

  return (data ?? [])
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      url: i.html_url,
      author: i.user.login,
      labels: i.labels.map((l) => l.name),
      createdAt: i.created_at,
    }));
}

export async function getOpenPullRequests(
  fullName: string,
  perPage = 10,
): Promise<GitHubPullRequestSummary[]> {
  const encoded = fullName
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const data = await githubGet<
    {
      number: number;
      title: string;
      html_url: string;
      user: { login: string };
      created_at: string;
    }[]
  >(`/repos/${encoded}/pulls?state=open&per_page=${perPage}`);

  return (data ?? []).map((pr) => ({
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    author: pr.user.login,
    createdAt: pr.created_at,
  }));
}
