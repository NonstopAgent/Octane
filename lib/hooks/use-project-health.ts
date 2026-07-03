"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  computeHealthScore,
  type HealthScore,
} from "@/lib/monitor/health-score";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Project, ProjectConnection } from "@/lib/types";
import type { Signal } from "@/lib/types/signal";

export type ProjectHealth = HealthScore & {
  projectId: string;
  latestDeployState: string | null;
  uptimePct24h: number | null;
  avgLatencyMs24h: number | null;
  lastCommitDaysAgo: number | null;
  monitored: boolean;
};

type ServerFactors = {
  name: string;
  latestDeployState: string | null;
  latestDeployAt: string | null;
  lastCommitDaysAgo: number | null;
  uptimePct24h: number | null;
  lastPingOk: boolean | null;
  avgLatencyMs24h: number | null;
  monitored: boolean;
};

function vercelNameFor(
  project: Project,
  connections: ProjectConnection[],
): string | undefined {
  const conn = connections.find(
    (c) => c.projectId === project.id && c.kind === "vercel" && c.status === "linked",
  );
  if (conn?.label?.trim()) return conn.label.trim();
  const slug = project.name
    .toLowerCase()
    .replace(/^octane\s+/i, "octane-")
    .replace(/\s+/g, "-");
  return slug.startsWith("octane-") ? slug : undefined;
}

function repoFor(
  project: Project,
  connections: ProjectConnection[],
): string | undefined {
  const conn = connections.find(
    (c) => c.projectId === project.id && c.kind === "github" && c.status === "linked",
  );
  const repo = conn?.repo?.trim() || conn?.label?.trim();
  return repo && repo.includes("/") ? repo : undefined;
}

function openSignalCounts(signals: Signal[], projectId: string) {
  const open = signals.filter(
    (s) =>
      s.projectId === projectId &&
      (s.status === "new" || s.status === "acknowledged" || s.status === "in_progress"),
  );
  return {
    critical: open.filter((s) => s.severity === "critical").length,
    high: open.filter((s) => s.severity === "high").length,
  };
}

/**
 * Portfolio health — merges server factors (deploys, commits, uptime) with
 * local open-signal counts and scores each project 0–100.
 */
export function useProjectHealth() {
  const { projects, projectConnections, signals } = useOctaneStore(
    useShallow((s) => ({
      projects: s.projects,
      projectConnections: s.projectConnections,
      signals: s.signals,
    })),
  );

  const [health, setHealth] = useState<Record<string, ProjectHealth>>({});
  const [loading, setLoading] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const serverFactorsRef = useRef<Map<string, ServerFactors>>(new Map());

  const score = useCallback(
    (factorsByProject: Map<string, ServerFactors>) => {
      const next: Record<string, ProjectHealth> = {};
      for (const project of projects) {
        const server = factorsByProject.get(project.id);
        const counts = openSignalCounts(signals, project.id);
        const computed = computeHealthScore({
          latestDeployState: server?.latestDeployState ?? null,
          openCriticalSignals: counts.critical,
          openHighSignals: counts.high,
          uptimePct24h: server?.uptimePct24h ?? null,
          lastPingOk: server?.lastPingOk ?? null,
          lastCommitDaysAgo: server?.lastCommitDaysAgo ?? null,
        });
        next[project.id] = {
          ...computed,
          projectId: project.id,
          latestDeployState: server?.latestDeployState ?? null,
          uptimePct24h: server?.uptimePct24h ?? null,
          avgLatencyMs24h: server?.avgLatencyMs24h ?? null,
          lastCommitDaysAgo: server?.lastCommitDaysAgo ?? null,
          monitored: server?.monitored ?? false,
        };
      }
      return next;
    },
    [projects, signals],
  );

  const refresh = useCallback(async () => {
    if (projects.length === 0) return;
    setLoading(true);
    try {
      const request = projects.map((p) => ({
        name: p.name,
        projectId: p.id,
        vercelProject: vercelNameFor(p, projectConnections),
        repo: repoFor(p, projectConnections),
      }));
      const res = await fetch("/api/monitor/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: request }),
      });
      if (res.ok) {
        const data = (await res.json()) as { projects?: ServerFactors[] };
        const byName = new Map((data.projects ?? []).map((f) => [f.name, f]));
        const byId = new Map<string, ServerFactors>();
        for (const p of projects) {
          const f = byName.get(p.name);
          if (f) byId.set(p.id, f);
        }
        serverFactorsRef.current = byId;
      }
    } catch (err) {
      console.warn("[useProjectHealth] refresh failed:", err);
    } finally {
      setHealth(score(serverFactorsRef.current));
      setRefreshedAt(new Date().toISOString());
      setLoading(false);
    }
  }, [projects, projectConnections, score]);

  // Score immediately from local signals; fetch server factors once on mount.
  const startedRef = useRef(false);
  useEffect(() => {
    setHealth(score(serverFactorsRef.current));
  }, [score]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void refreshRef.current();
  }, []);

  return { health, loading, refresh, refreshedAt };
}
