import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { getRepo } from "@/lib/integrations/github-client";
import { getLatestDeployment } from "@/lib/integrations/vercel-client";
import { monitorServiceDb, summarizeUptime } from "@/lib/monitor/heartbeat";

export const runtime = "nodejs";

type HealthRequestProject = {
  /** Display/matching name (also used to match monitor targets). */
  name: string;
  /** Vercel project name (optional). */
  vercelProject?: string;
  /** GitHub repo full name owner/repo (optional). */
  repo?: string;
};

export type ProjectHealthFactors = {
  name: string;
  latestDeployState: string | null;
  latestDeployAt: string | null;
  lastCommitDaysAgo: number | null;
  uptimePct24h: number | null;
  lastPingOk: boolean | null;
  avgLatencyMs24h: number | null;
  monitored: boolean;
};

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / (1000 * 60 * 60 * 24));
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Server-side health factors per project (deploys, commits, uptime).
 * The client merges open signal counts from the store and computes the
 * final score via lib/monitor/health-score (isomorphic).
 *
 * POST body: { projects: [{ name, vercelProject?, repo? }] }
 */
export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  let body: { projects?: HealthRequestProject[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projects = (body.projects ?? []).slice(0, 20);
  if (projects.length === 0) {
    return NextResponse.json({ projects: [], checkedAt: new Date().toISOString() });
  }

  // Uptime summaries once for all targets.
  const db = monitorServiceDb();
  const uptime = db ? await summarizeUptime(db).catch(() => []) : [];

  const results: ProjectHealthFactors[] = await Promise.all(
    projects.map(async (p) => {
      const [deployment, repo] = await Promise.all([
        p.vercelProject
          ? getLatestDeployment(p.vercelProject).catch(() => null)
          : Promise.resolve(null),
        p.repo ? getRepo(p.repo).catch(() => null) : Promise.resolve(null),
      ]);

      const key = normalize(p.vercelProject ?? p.name);
      // Exact match first; fall back to the longest partial overlap so
      // "octane" cannot shadow "octane-ajax" or "octane-nexus-6em9".
      const target =
        uptime.find((t) => normalize(t.projectName) === key) ??
        uptime
          .filter((t) => {
            const tk = normalize(t.projectName);
            return tk.includes(key) || key.includes(tk);
          })
          .sort(
            (a, b) => normalize(b.projectName).length - normalize(a.projectName).length,
          )[0];

      return {
        name: p.name,
        latestDeployState: deployment?.readyState ?? deployment?.state ?? null,
        latestDeployAt: deployment?.createdAt ?? null,
        lastCommitDaysAgo: daysAgo(repo?.pushedAt ?? null),
        uptimePct24h: target?.uptimePct24h ?? null,
        lastPingOk: target?.lastOk ?? null,
        avgLatencyMs24h: target?.avgLatencyMs24h ?? null,
        monitored: Boolean(target),
      };
    }),
  );

  return NextResponse.json({
    projects: results,
    checkedAt: new Date().toISOString(),
  });
}
