import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import type { Signal, SignalSeverity } from "@/lib/types/signal";

export const runtime = "nodejs";

/** Canonical live repos — always checked even if the workspace links are stale. */
const CANONICAL_REPOS: RepoTarget[] = [
  { repo: "NonstopAgent/Octane", label: "Octane Core" },
  { repo: "NonstopAgent/Octane_Ajax", label: "Octane Ajax" },
  { repo: "NonstopAgent/Octane_Nexus", label: "Octane Nexus" },
];

type RepoTarget = { repo: string; label: string; projectId?: string };

/** Fold stale hyphen repo names onto the real underscore repos. */
function normalizeRepo(repo: string): string {
  return repo
    .replace("NonstopAgent/Octane-Ajax", "NonstopAgent/Octane_Ajax")
    .replace("NonstopAgent/Octane-Nexus", "NonstopAgent/Octane_Nexus");
}

function ghHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function daysAgo(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function slug(repo: string): string {
  return repo.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
}

function mkSignal(
  kind: string,
  repo: string,
  severity: SignalSeverity,
  title: string,
  summary: string,
  recommendedAction: string,
  extra?: {
    projectId?: string;
    url?: string;
    type?: Signal["type"];
  },
): Signal {
  const ts = new Date().toISOString();
  return {
    id: `sig-github-${kind}-${slug(repo)}`,
    source: "github",
    type: extra?.type ?? "risk",
    title,
    summary,
    severity,
    status: "new",
    projectId: extra?.projectId,
    entityId: repo,
    recommendedAction,
    isLive: true,
    isDerived: false,
    enrichedMetadata: extra?.url ? { url: extra.url, repo } : { repo },
    createdAt: ts,
    updatedAt: ts,
  };
}

interface GhRepo {
  name: string;
  html_url: string;
  default_branch: string;
  open_issues_count: number;
  pushed_at: string | null;
  archived?: boolean;
}
interface GhPR {
  number: number;
  title: string;
  html_url: string;
  draft?: boolean;
  created_at: string;
}
interface GhRun {
  name?: string;
  head_branch?: string;
  status?: string;
  conclusion?: string | null;
  html_url?: string;
  event?: string;
}
interface GhAlert {
  state: string;
  security_advisory?: { severity?: string };
  security_vulnerability?: { severity?: string };
}

async function jsonOrNull<T>(
  settled: PromiseSettledResult<Response>,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  if (settled.status !== "fulfilled") return { ok: false, status: 0, data: null };
  const res = settled.value;
  if (!res.ok) return { ok: false, status: res.status, data: null };
  try {
    return { ok: true, status: res.status, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: res.status, data: null };
  }
}

async function signalsForRepo(target: RepoTarget): Promise<Signal[]> {
  const repo = normalizeRepo(target.repo);
  const headers = ghHeaders();
  const [repoS, prS, runsS, alertsS] = await Promise.allSettled([
    fetch(`https://api.github.com/repos/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=20`, {
      headers,
    }),
    fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=10`, {
      headers,
    }),
    fetch(
      `https://api.github.com/repos/${repo}/dependabot/alerts?state=open&per_page=50`,
      { headers },
    ),
  ]);

  const repoData = (await jsonOrNull<GhRepo>(repoS)).data;
  const prs = (await jsonOrNull<GhPR[]>(prS)).data ?? [];
  const runs = (await jsonOrNull<GhRun[]>(runsS)).data;
  const alertsResult = await jsonOrNull<GhAlert[]>(alertsS);

  const label = target.label || repoData?.name || repo.split("/")[1];
  const projectId = target.projectId;
  const signals: Signal[] = [];

  if (!repoData) return signals; // repo unreachable (404/private/no token) — no signal noise

  // 1. Failing CI on the default branch
  const defaultBranch = repoData.default_branch;
  const latestRun = Array.isArray(runs)
    ? runs.find((r) => r.head_branch === defaultBranch && r.status === "completed")
    : undefined;
  if (latestRun && latestRun.conclusion === "failure") {
    signals.push(
      mkSignal(
        "ci",
        repo,
        "high",
        `${label}: CI failing on ${defaultBranch}`,
        `The latest workflow${latestRun.name ? ` "${latestRun.name}"` : ""} failed on ${defaultBranch}.`,
        "Open the failing run and fix the build before shipping.",
        { projectId, url: latestRun.html_url, type: "deployment" },
      ),
    );
  }

  // 2. Open security (Dependabot) alerts
  const alerts = Array.isArray(alertsResult.data) ? alertsResult.data : [];
  if (alerts.length > 0) {
    const sevs = alerts.map(
      (a) =>
        a.security_advisory?.severity ??
        a.security_vulnerability?.severity ??
        "medium",
    );
    const worst: SignalSeverity = sevs.includes("critical")
      ? "critical"
      : sevs.includes("high")
        ? "high"
        : "medium";
    signals.push(
      mkSignal(
        "vuln",
        repo,
        worst,
        `${label}: ${alerts.length} open security alert${alerts.length === 1 ? "" : "s"}`,
        `Dependabot reports ${alerts.length} unresolved vulnerabilit${alerts.length === 1 ? "y" : "ies"} (worst: ${worst}).`,
        "Review Dependabot alerts and merge the security updates.",
        { projectId, url: `${repoData.html_url}/security/dependabot`, type: "risk" },
      ),
    );
  }

  // 3. Open PRs awaiting review (non-draft)
  const openPrs = prs.filter((p) => !p.draft);
  if (openPrs.length > 0) {
    const oldest = openPrs.reduce(
      (min, p) => Math.min(min, daysAgo(p.created_at) ?? 0),
      Number.POSITIVE_INFINITY,
    );
    const oldestDays = Number.isFinite(oldest) ? oldest : 0;
    signals.push(
      mkSignal(
        "prs",
        repo,
        oldestDays > 7 ? "medium" : "low",
        `${label}: ${openPrs.length} open PR${openPrs.length === 1 ? "" : "s"} awaiting review`,
        `${openPrs.length} pull request${openPrs.length === 1 ? "" : "s"} open${oldestDays > 0 ? `, oldest ${oldestDays}d` : ""}.`,
        "Review and merge or close the open pull requests.",
        { projectId, url: `${repoData.html_url}/pulls`, type: "task" },
      ),
    );
  }

  // 4. Stale repo — no push in a while
  const stale = daysAgo(repoData.pushed_at);
  if (!repoData.archived && stale !== null && stale > 21) {
    signals.push(
      mkSignal(
        "stale",
        repo,
        stale > 45 ? "high" : "medium",
        `${label}: no push in ${stale} days`,
        `${label} hasn't received a commit in ${stale} days — momentum is stalling.`,
        "Ship an update, or set the project to paused if it's intentionally on hold.",
        { projectId, url: repoData.html_url, type: "risk" },
      ),
    );
  }

  return signals;
}

function parseTargets(raw: unknown): RepoTarget[] {
  const provided: RepoTarget[] = [];
  if (raw && typeof raw === "object" && Array.isArray((raw as { repos?: unknown[] }).repos)) {
    for (const r of (raw as { repos: unknown[] }).repos) {
      if (r && typeof r === "object") {
        const t = r as { repo?: unknown; label?: unknown; projectId?: unknown };
        if (typeof t.repo === "string" && t.repo.includes("/")) {
          provided.push({
            repo: t.repo,
            label: typeof t.label === "string" ? t.label : "",
            projectId: typeof t.projectId === "string" ? t.projectId : undefined,
          });
        }
      }
    }
  }
  // Merge canonical repos with any extra linked repos (dedupe by normalized repo).
  const byRepo = new Map<string, RepoTarget>();
  for (const t of [...CANONICAL_REPOS, ...provided]) {
    const key = normalizeRepo(t.repo);
    const existing = byRepo.get(key);
    // Prefer an entry that carries a projectId / label.
    if (!existing || (!existing.projectId && t.projectId)) {
      byRepo.set(key, {
        repo: key,
        label: t.label || existing?.label || "",
        projectId: t.projectId ?? existing?.projectId,
      });
    }
  }
  return [...byRepo.values()];
}

async function buildResponse(targets: RepoTarget[]) {
  const configured = Boolean(process.env.GITHUB_TOKEN);
  const perRepo = await Promise.all(targets.map((t) => signalsForRepo(t)));
  const signals = perRepo.flat();
  return NextResponse.json({ signals, configured, checked: targets.length });
}

export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;
  return buildResponse(CANONICAL_REPOS);
}

export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;
  let targets = CANONICAL_REPOS;
  try {
    const body = await request.json();
    targets = parseTargets(body);
  } catch {
    targets = CANONICAL_REPOS;
  }
  return buildResponse(targets);
}
