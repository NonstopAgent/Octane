/**
 * Octane Autonomous Daily Briefing — /api/cron/briefing
 *
 * Runs on a schedule (configured in vercel.json).
 * Fetches live repo data from Ajax + Nexus, uses Claude to generate
 * an actionable briefing, then posts it as a GitHub issue so Logan
 * sees it without opening the app.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY — for Claude
 *   GITHUB_TOKEN — to create the briefing issue
 *   CRON_SECRET — to verify this route is called by Vercel Cron (not public)
 *
 * Optional:
 *   BRIEFING_REPO — where to post the issue (default: NonstopAgent/Octane-Ajax)
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const AJAX_REPO = "NonstopAgent/Octane-Ajax";
const NEXUS_REPO = "NonstopAgent/Octane-Nexus";

// ─── GitHub helpers ───────────────────────────────────────────────────────────

function githubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "OctaneCore-Cron/1.0",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

interface RepoSnapshot {
  repo: string;
  description: string | null;
  language: string | null;
  openIssues: number;
  openPRs: number;
  lastCommit: {
    sha: string;
    message: string;
    author: string;
    date: string;
  } | null;
  recentIssues: { number: number; title: string; labels: string[] }[];
  recentPRs: { number: number; title: string; author: string }[];
  pushedAt: string | null;
}

async function getRepoSnapshot(repo: string): Promise<RepoSnapshot> {
  const headers = githubHeaders();

  const [repoRes, commitsRes, issuesRes, prsRes] = await Promise.allSettled([
    fetch(`https://api.github.com/repos/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=10&sort=updated`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=5`, { headers }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repoData: any =
    repoRes.status === "fulfilled" && repoRes.value.ok
      ? await repoRes.value.json()
      : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commits: any[] =
    commitsRes.status === "fulfilled" && commitsRes.value.ok
      ? await commitsRes.value.json()
      : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issues: any[] =
    issuesRes.status === "fulfilled" && issuesRes.value.ok
      ? await issuesRes.value.json()
      : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prs: any[] =
    prsRes.status === "fulfilled" && prsRes.value.ok
      ? await prsRes.value.json()
      : [];

  // Issues endpoint includes PRs — filter them out
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realIssues = issues.filter((i: any) => !i.pull_request);

  return {
    repo,
    description: repoData?.description ?? null,
    language: repoData?.language ?? null,
    openIssues: repoData?.open_issues_count ?? realIssues.length,
    openPRs: prs.length,
    lastCommit: commits[0]
      ? {
          sha: (commits[0].sha as string).slice(0, 7),
          message: (commits[0].commit.message as string).split("\n")[0],
          author: commits[0].commit.author.name as string,
          date: commits[0].commit.author.date as string,
        }
      : null,
    recentIssues: realIssues.slice(0, 5).map((i: { number: number; title: string; labels: { name: string }[] }) => ({
      number: i.number,
      title: i.title,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      labels: i.labels.map((l: any) => l.name as string),
    })),
    recentPRs: prs.slice(0, 3).map((p: { number: number; title: string; user: { login: string } }) => ({
      number: p.number,
      title: p.title,
      author: p.user.login,
    })),
    pushedAt: repoData?.pushed_at ?? null,
  };
}

async function createGitHubIssue(
  repo: string,
  title: string,
  body: string,
  labels: string[] = [],
): Promise<string | null> {
  if (!process.env.GITHUB_TOKEN) return null;

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      ...githubHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, labels }),
  });

  if (!res.ok) {
    console.error("[cron] Failed to create GitHub issue:", res.status, await res.text());
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json()) as any;
  return data.html_url as string;
}

// ─── Claude briefing generation ───────────────────────────────────────────────

async function generateBriefing(
  ajax: RepoSnapshot,
  nexus: RepoSnapshot,
  date: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const repoSummary = (snap: RepoSnapshot) => `
**${snap.repo}**
- Language: ${snap.language ?? "unknown"} | Open issues: ${snap.openIssues} | Open PRs: ${snap.openPRs}
- Last push: ${snap.pushedAt ? new Date(snap.pushedAt).toLocaleDateString() : "unknown"}
- Last commit: ${snap.lastCommit ? `${snap.lastCommit.sha} — "${snap.lastCommit.message}" by ${snap.lastCommit.author} (${new Date(snap.lastCommit.date).toLocaleDateString()})` : "no commits"}
${snap.recentIssues.length > 0 ? `- Open issues: ${snap.recentIssues.map((i) => `#${i.number} ${i.title}${i.labels.length ? ` [${i.labels.join(", ")}]` : ""}`).join("; ")}` : "- No open issues"}
${snap.recentPRs.length > 0 ? `- Open PRs: ${snap.recentPRs.map((p) => `#${p.number} ${p.title}`).join("; ")}` : "- No open PRs"}
`.trim();

  const prompt = `You are Octane AI. Today is ${date}. You run the daily autonomous briefing for Logan's portfolio.

Here is the current state of both repos:

${repoSummary(ajax)}

${repoSummary(nexus)}

Generate a focused daily briefing. Be direct and specific — Logan is a solo developer, so surface only what actually matters.

Structure your response as:

## Status
One sentence per repo on where things stand.

## Flags
Anything that needs Logan's attention today — open PRs that look stale, issues that are piling up, long gaps in commits, etc. Be specific (issue numbers, PR numbers). If nothing flags, say so.

## Recommended Actions
2-4 specific, actionable things Logan should do today based on this repo state. Priority order.

## Pulse
One sentence on the overall health of the portfolio right now.

Keep it under 400 words. No fluff.`;

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return textBlock?.text ?? "Briefing generation failed.";
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify the request is from Vercel Cron (or local dev)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const todayShort = new Date().toISOString().slice(0, 10);

  console.log(`[cron/briefing] Starting daily briefing for ${todayShort}`);

  try {
    // Fetch repo snapshots in parallel
    const [ajax, nexus] = await Promise.all([
      getRepoSnapshot(AJAX_REPO),
      getRepoSnapshot(NEXUS_REPO),
    ]);

    console.log(`[cron/briefing] Fetched repo snapshots. Ajax issues: ${ajax.openIssues}, Nexus issues: ${nexus.openIssues}`);

    // Generate AI briefing
    const briefingText = await generateBriefing(ajax, nexus, today);

    console.log("[cron/briefing] Briefing generated, length:", briefingText.length);

    // Format the GitHub issue body
    const issueBody = `<!-- Octane Autonomous Briefing — generated ${new Date().toISOString()} -->

${briefingText}

---

**Repo snapshots at time of briefing:**

| Repo | Open Issues | Open PRs | Last Push |
|------|-------------|----------|-----------|
| [Ajax](https://github.com/${AJAX_REPO}) | ${ajax.openIssues} | ${ajax.openPRs} | ${ajax.pushedAt ? new Date(ajax.pushedAt).toLocaleDateString() : "—"} |
| [Nexus](https://github.com/${NEXUS_REPO}) | ${nexus.openIssues} | ${nexus.openPRs} | ${nexus.pushedAt ? new Date(nexus.pushedAt).toLocaleDateString() : "—"} |

*Generated by Octane Core autonomous cron — [chat.octane.ai/chat](https://octane.ai/chat)*
`;

    // Post the briefing as a GitHub issue (if token is available)
    const briefingRepo = process.env.BRIEFING_REPO ?? AJAX_REPO;
    const issueUrl = await createGitHubIssue(
      briefingRepo,
      `📊 Daily Briefing — ${todayShort}`,
      issueBody,
      ["briefing", "automated"],
    );

    if (issueUrl) {
      console.log(`[cron/briefing] Issue created: ${issueUrl}`);
    } else {
      console.warn("[cron/briefing] No GITHUB_TOKEN — skipping issue creation");
    }

    return NextResponse.json({
      ok: true,
      date: todayShort,
      ajaxIssues: ajax.openIssues,
      ajaxPRs: ajax.openPRs,
      nexusIssues: nexus.openIssues,
      nexusPRs: nexus.openPRs,
      briefingLength: briefingText.length,
      issueUrl: issueUrl ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/briefing] Failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
