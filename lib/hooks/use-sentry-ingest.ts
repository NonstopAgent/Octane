"use client";

import { useCallback, useEffect, useRef } from "react";

import { syncSignalActionProposals } from "@/lib/actions/sync-signal-action-proposals";
import { requestCriticalAlertDispatch } from "@/lib/notifications/request-critical-alerts";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Project } from "@/lib/types";
import type { Signal } from "@/lib/types/signal";

type SentryPendingItem = {
  queueId: string;
  signal: Signal;
};

function resolveProjectIdForSlug(slug: string, projects: Project[]): string | undefined {
  const key = slug.replace(/^octane-/, "").toLowerCase();
  const hit = projects.find((p) => {
    const n = p.name.toLowerCase();
    return n.includes(key) || (p.isCore && slug === "octane-core");
  });
  return hit?.id;
}

function attachProjectIds(signals: Signal[], projects: Project[]): Signal[] {
  return signals.map((s) => {
    const slug = String(s.enrichedMetadata?.targetProjectSlug ?? "");
    const projectId = resolveProjectIdForSlug(slug, projects) ?? s.projectId;
    return projectId ? { ...s, projectId } : s;
  });
}

/**
 * Pull Sentry webhook ingest queue into Zustand (signals + hotfix action proposals).
 * Webhooks cannot write the client store directly.
 */
export function useSentryIngest() {
  const upsertSignals = useOctaneStore((s) => s.upsertSignals);
  const projects = useOctaneStore((s) => s.projects);
  const recordActivity = useOctaneStore((s) => s.recordActivity);
  const pulledRef = useRef(false);

  const pullSentryIngest = useCallback(async (): Promise<number> => {
    try {
      const res = await fetch("/api/integrations/sentry/pending");
      if (!res.ok) return 0;
      const data = (await res.json()) as { items?: SentryPendingItem[] };
      const items = data.items ?? [];
      if (items.length === 0) return 0;

      const signals = attachProjectIds(
        items.map((i) => i.signal),
        projects,
      );
      upsertSignals(signals);
      syncSignalActionProposals(useOctaneStore.getState, signals);
      void requestCriticalAlertDispatch(signals);
      recordActivity({
        action: "updated",
        entityType: "system",
        entityId: "sentry",
        entityName: "Sentry",
        description: `Ingested ${items.length} Sentry exception signal(s) from webhook queue.`,
      });
      return items.length;
    } catch (err) {
      console.warn("[useSentryIngest] pull failed:", err);
      return 0;
    }
  }, [upsertSignals, projects, recordActivity]);

  useEffect(() => {
    if (pulledRef.current) return;
    pulledRef.current = true;
    void pullSentryIngest();
  }, [pullSentryIngest]);

  return { pullSentryIngest };
}
