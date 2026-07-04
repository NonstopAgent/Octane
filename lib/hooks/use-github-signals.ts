"use client";

import { useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { requestCriticalAlertDispatch } from "@/lib/notifications/request-critical-alerts";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Signal } from "@/lib/types/signal";

type GithubFetchResult = {
  signals: Signal[];
  configured: boolean;
  error?: string;
};

/** Resolve linked GitHub repos from project connections → {repo,label,projectId}. */
function resolveRepoTargets(
  projectConnections: { projectId: string; kind: string; repo?: string; status: string }[],
  projects: { id: string; name: string }[],
): { repo: string; label: string; projectId: string }[] {
  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  return projectConnections
    .filter((pc) => pc.kind === "github" && pc.status === "linked" && pc.repo)
    .map((pc) => ({
      repo: pc.repo as string,
      label: nameById.get(pc.projectId) ?? "",
      projectId: pc.projectId,
    }));
}

export function useGithubSignals() {
  const { projects, projectConnections } = useOctaneStore(
    useShallow((s) => ({
      projects: s.projects,
      projectConnections: s.projectConnections,
    })),
  );
  const upsertSignals = useOctaneStore((s) => s.upsertSignals);
  const recordActivity = useOctaneStore((s) => s.recordActivity);
  const [loading, setLoading] = useState(false);

  const refreshGithubSignals = useCallback(async (): Promise<GithubFetchResult> => {
    setLoading(true);
    try {
      const repos = resolveRepoTargets(projectConnections, projects);
      const res = await fetch("/api/github/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repos }),
      });
      if (!res.ok) {
        throw new Error(`GitHub signal fetch failed (${res.status})`);
      }
      const data = (await res.json()) as {
        signals: Signal[];
        configured: boolean;
        error?: string;
      };
      const signals = data.signals ?? [];
      if (signals.length > 0) {
        upsertSignals(signals);
        void requestCriticalAlertDispatch(signals);
      }
      recordActivity({
        action: "updated",
        entityType: "system",
        entityId: "github",
        entityName: "GitHub",
        description: `Checked repos for live status; ${signals.length} GitHub signal(s).`,
      });
      return { signals, configured: data.configured, error: data.error };
    } finally {
      setLoading(false);
    }
  }, [projectConnections, projects, upsertSignals, recordActivity]);

  return { refreshGithubSignals, loading };
}
