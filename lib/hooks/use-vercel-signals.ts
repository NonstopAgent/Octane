"use client";

import { useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { resolveVercelProjectNames } from "@/lib/signals/vercel-deployment-signals";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";
import type { Signal } from "@/lib/types/signal";

type VercelFetchResult = {
  signals: Signal[];
  configured: boolean;
  error?: string;
};

export function useVercelSignals() {
  const { projects, projectConnections } = useOctaneStore(
    useShallow((s) => ({
      projects: s.projects,
      projectConnections: s.projectConnections,
    })),
  );
  const upsertSignals = useOctaneStore((s) => s.upsertSignals);
  const recordActivity = useOctaneStore((s) => s.recordActivity);
  const [loading, setLoading] = useState(false);

  const refreshVercelSignals = useCallback(async (): Promise<VercelFetchResult> => {
    setLoading(true);
    try {
      const names = resolveVercelProjectNames(projectConnections, projects);
      const params = new URLSearchParams({
        names: names.join(","),
        projects: JSON.stringify(
          projects.map((p) => ({ id: p.id, name: p.name, isCore: p.isCore })),
        ),
      });
      const res = await fetch(`/api/integrations/vercel/deployments?${params}`);
      if (!res.ok) {
        throw new Error(`Vercel deployment fetch failed (${res.status})`);
      }
      const data = (await res.json()) as {
        signals: Signal[];
        configured: boolean;
        error?: string;
      };
      const signals = data.signals ?? [];
      if (signals.length > 0) {
        upsertSignals(signals);
      }
      if (signals.length > 0 || data.configured) {
        recordActivity({
          action: "updated",
          entityType: "system",
          entityId: "vercel",
          entityName: "Vercel",
          description: `Checked ${names.length} Vercel project(s); ${signals.length} deployment signal(s).`,
        });
      }
      return { signals, configured: data.configured, error: data.error };
    } finally {
      setLoading(false);
    }
  }, [projectConnections, projects, upsertSignals, recordActivity]);

  return { refreshVercelSignals, loading };
}
