import { fetchWithTimeout } from "@/lib/integrations/http";

const GITHUB_API = "https://api.github.com";

function githubHeaders(): Record<string, string> | null {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) return null;
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function encodeRepo(fullName: string): string {
  return fullName
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
}

async function githubRequest(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  const headers = githubHeaders();
  if (!headers) return null;
  return fetchWithTimeout(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string>) },
  });
}

export type GitHubWriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export type GitHubBranchRef = {
  name: string;
  sha: string;
};

export type GitHubFileContent = {
  path: string;
  sha: string;
  content: string;
  encoding: "base64";
};

export type GitHubPullRequest = {
  number: number;
  html_url: string;
  title: string;
  head: { ref: string };
  base: { ref: string };
};

/** Create a branch from an existing ref SHA. */
export async function createBranch(
  repo: string,
  branchName: string,
  fromSha: string,
): Promise<GitHubWriteResult<GitHubBranchRef>> {
  const encoded = encodeRepo(repo);
  const res = await githubRequest(`/repos/${encoded}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: fromSha }),
  });
  if (!res) {
    return { ok: false, error: "GITHUB_TOKEN not configured on server" };
  }
  if (!res.ok) {
    const body = await res.text();
    return {
      ok: false,
      error: body || `Failed to create branch (${res.status})`,
      status: res.status,
    };
  }
  const data = (await res.json()) as { ref: string; object: { sha: string } };
  return {
    ok: true,
    data: { name: branchName, sha: data.object.sha },
  };
}

/** Resolve default branch ref SHA (main/master). */
export async function getDefaultBranchSha(
  repo: string,
  preferredBranch = "main",
): Promise<GitHubWriteResult<{ branch: string; sha: string }>> {
  const encoded = encodeRepo(repo);
  for (const branch of [preferredBranch, "main", "master"]) {
    const res = await githubRequest(`/repos/${encoded}/git/ref/heads/${branch}`);
    if (!res) {
      return { ok: false, error: "GITHUB_TOKEN not configured on server" };
    }
    if (res.ok) {
      const data = (await res.json()) as { object: { sha: string } };
      return { ok: true, data: { branch, sha: data.object.sha } };
    }
  }
  return { ok: false, error: `Could not resolve base branch for ${repo}` };
}

export async function getFileContent(
  repo: string,
  path: string,
  ref: string,
): Promise<GitHubWriteResult<GitHubFileContent | null>> {
  const encoded = encodeRepo(repo);
  const res = await githubRequest(
    `/repos/${encoded}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`,
  );
  if (!res) {
    return { ok: false, error: "GITHUB_TOKEN not configured on server" };
  }
  if (res.status === 404) {
    return { ok: true, data: null };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: `Failed to read file (${res.status})`,
      status: res.status,
    };
  }
  const raw = (await res.json()) as GitHubFileContent;
  return { ok: true, data: raw };
}

/** Create or update a single file on a branch (no delete API). */
export async function upsertFile(
  repo: string,
  path: string,
  branch: string,
  content: string,
  message: string,
  existingSha?: string,
): Promise<GitHubWriteResult<{ sha: string; path: string }>> {
  const encoded = encodeRepo(repo);
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
  };
  if (existingSha) body.sha = existingSha;

  const res = await githubRequest(
    `/repos/${encoded}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res) {
    return { ok: false, error: "GITHUB_TOKEN not configured on server" };
  }
  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      error: text || `Failed to upsert file (${res.status})`,
      status: res.status,
    };
  }
  const data = (await res.json()) as { content: { sha: string; path: string } };
  return { ok: true, data: { sha: data.content.sha, path: data.content.path } };
}

export async function createPullRequest(
  repo: string,
  title: string,
  head: string,
  base: string,
  body: string,
): Promise<GitHubWriteResult<GitHubPullRequest>> {
  const encoded = encodeRepo(repo);
  const res = await githubRequest(`/repos/${encoded}/pulls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, head, base, body }),
  });
  if (!res) {
    return { ok: false, error: "GITHUB_TOKEN not configured on server" };
  }
  if (!res.ok) {
    const text = await res.text();
    return {
      ok: false,
      error: text || `Failed to create PR (${res.status})`,
      status: res.status,
    };
  }
  const data = (await res.json()) as GitHubPullRequest;
  return { ok: true, data };
}

export async function getPullRequest(
  repo: string,
  number: number,
): Promise<GitHubWriteResult<GitHubPullRequest>> {
  const encoded = encodeRepo(repo);
  const res = await githubRequest(`/repos/${encoded}/pulls/${number}`);
  if (!res) {
    return { ok: false, error: "GITHUB_TOKEN not configured on server" };
  }
  if (!res.ok) {
    return {
      ok: false,
      error: `Failed to fetch PR (${res.status})`,
      status: res.status,
    };
  }
  return { ok: true, data: (await res.json()) as GitHubPullRequest };
}
