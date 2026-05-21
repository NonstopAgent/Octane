"use client";

import { useCallback, useState } from "react";

import { syncSignalActionProposals } from "@/lib/actions/sync-signal-action-proposals";
import { requestCriticalAlertDispatch } from "@/lib/notifications/request-critical-alerts";
import { normalizeGmailSignals } from "@/lib/signals/normalize-gmail-signals";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { GmailMessage } from "@/lib/types/gmail-message";
import type { Signal } from "@/lib/types/signal";

type GmailFetchResult = {
  signals: Signal[];
  provenance: "live" | "mock";
  error?: string;
};

export function useGmailSignals() {
  const upsertSignals = useOctaneStore((s) => s.upsertSignals);
  const recordActivity = useOctaneStore((s) => s.recordActivity);
  const projects = useOctaneStore((s) => s.projects);
  const entities = useOctaneStore((s) => s.entities);
  const [loading, setLoading] = useState(false);
  const [lastProvenance, setLastProvenance] = useState<"live" | "mock" | null>(
    null,
  );

  const refreshGmailSignals = useCallback(async (): Promise<GmailFetchResult> => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/gmail/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projects: projects.map((p) => ({ id: p.id, name: p.name })),
          entities: entities.map((e) => ({
            id: e.id,
            name: e.name,
            linkedProjectIds: e.linkedProjectIds,
          })),
        }),
      });
      if (!res.ok) {
        throw new Error(`Gmail fetch failed (${res.status})`);
      }
      const data = (await res.json()) as {
        messages: GmailMessage[];
        signals?: Signal[];
        provenance: "live" | "mock";
        error?: string;
      };
      const signals =
        data.signals?.length
          ? data.signals
          : normalizeGmailSignals(data.messages ?? []);
      upsertSignals(signals);
      syncSignalActionProposals(useOctaneStore.getState, signals);
      void requestCriticalAlertDispatch(signals);
      setLastProvenance(data.provenance);
      recordActivity({
        action: "updated",
        entityType: "system",
        entityId: "gmail",
        entityName: "Gmail",
        description: `Ingested ${signals.length} Gmail signal(s) (${data.provenance}${data.error ? ", stub" : ""})`,
      });
      return { signals, provenance: data.provenance, error: data.error };
    } finally {
      setLoading(false);
    }
  }, [upsertSignals, recordActivity, projects, entities]);

  return { refreshGmailSignals, loading, lastProvenance };
}
