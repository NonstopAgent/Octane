import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Cache responses for 60 seconds to avoid rate limiting
const cache = new Map<string, { data: unknown; expires: number }>();

async function fetchGitHubRepo(repo: string) {
  const cached = cache.get(repo);
  if (cached && cached.expires > Date.now()) return cached.data;

  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const [repoRes, commitsRes, prsRes] = await Promise.allSettled([
    fetch(`https://api.github.com/repos/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=5`, { headers }),
  ]);

  interface GitHubRepoData {
    name: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    language: string | null;
    default_branch: string;
    visibility: string;
    pushed_at: string;
  }

  interface GitHubCommit {
    sha: string;
    commit: {
      message: string;
      author: {
        name: string;
        date: string;
      };
    };
    html_url: string;
  }

  interface GitHubPR {
    number: number;
    title: string;
    html_url: string;
    user: { login: string };
  }

  const repoData = repoRes.status === "fulfilled" && repoRes.value.ok
    ? (await repoRes.value.json()) as GitHubRepoData
    : null;
  const commitsData = commitsRes.status === "fulfilled" && commitsRes.value.ok
    ? (await commitsRes.value.json()) as GitHubCommit[]
    : [];
  const prsData = prsRes.status === "fulfilled" && prsRes.value.ok
    ? (await prsRes.value.json()) as GitHubPR[]
    : [];

  const result = {
    name: repoData?.name ?? repo.split("/")[1],
    description: repoData?.description ?? null,
    stars: repoData?.stargazers_count ?? 0,
    forks: repoData?.forks_count ?? 0,
    openIssues: repoData?.open_issues_count ?? 0,
    language: repoData?.language ?? null,
    defaultBranch: repoData?.default_branch ?? "main",
    visibility: repoData?.visibility ?? "private",
    pushedAt: repoData?.pushed_at ?? null,
    lastCommit: commitsData[0]
      ? {
          sha: (commitsData[0] as GitHubCommit).sha.slice(0, 7),
          message: (commitsData[0] as GitHubCommit).commit.message.split("\n")[0],
          author: (commitsData[0] as GitHubCommit).commit.author.name,
          date: (commitsData[0] as GitHubCommit).commit.author.date,
          url: (commitsData[0] as GitHubCommit).html_url,
        }
      : null,
    openPRs: (prsData as GitHubPR[]).slice(0, 5).map((pr) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      author: pr.user.login,
    })),
  };

  cache.set(repo, { data: result, expires: Date.now() + 60_000 });
  return result;
}

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get("repo");
  if (!repo || !repo.includes("/")) {
    return NextResponse.json({ error: "repo param required (owner/name)" }, { status: 400 });
  }

  try {
    const data = await fetchGitHubRepo(repo);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
