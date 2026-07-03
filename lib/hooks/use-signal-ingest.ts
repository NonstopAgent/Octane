"use client";

import { useCallback, useEffect, useRef } from "react";

import { syncSignalActionProposals } from "@/lib/actions/sync-signal-action-proposals";
import { requestCriticalAlertDispatch } from "@/lib/notifications/request-critical-alerts";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Project } from "@/lib/types";
import type { Signal } from "@/lib/types/signal";

type PendingItem = {
  queueId: string;
  source: string;
  signal: Signal;
  actionProposal?: unknown | null;
};

const DRAIN_INTERVAL_MS = 60_000;
const HEARTBEAT_INTERVAL_MS = 5 * 60_000;

function resolveProjectIdForSlug(slug: string, projects: Project[]): string | undefined {
  if (!slug) return undefined;
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
 * Pull the generic webhook ingest queue (sentry, vercel, github, monitor)
 * into Zustand, and trigger uptime heartbeats while the app is open.
 * Polls every 60s so webhook signals appear near-real-time.
 */
export function useSignalIngest() {
  const upsertSignals = useOctaneStore((s) => s.upsertSignals);
  const projects = useOctaneStore((s) => s.projects);
  const recordActivity = useOctaneStore((s) => s.recordActivity);
  const startedRef = useRef(false);

  const pullSignalIngest = useCallback(async (): Promise<number> => {
    try {
      const res = await fetch("/api/integrations/ingest/pending");
      if (!res.ok) return 0;
      const data = (await res.json()) as { items?: PendingItem[] };
      const items = data.items ?? [];
      if (items.length === 0) return 0;

      const signals = attachProjectIds(
        items.map((i) => i.signal),
        projects,
      );
      upsertSignals(signals);

      // Only sentry payloads carry hotfix action proposals today.
      const proposalSignals = attachProjectIds(
        items.filter((i) => i.actionProposal).map((i) => i.signal),
        projects,
      );
      if (proposalSignals.length > 0) {
        syncSignalActionProposals(useOctaneStore.getState, proposalSignals);
      }

      void requestCriticalAlertDispatch(signals);

      const bySource = items.reduce<Record<string, number>>((acc, i) => {
        acc[i.source] = (acc[i.source] ?? 0) + 1;
        return acc;
      }, {});
      const parts = Object.entries(bySource)
        .map(([source, count]) => `${count} ${source}`)
        .join(", ");
      recordActivity({
        action: "updated",
        entityType: "system",
        entityId: "ingest",
        entityName: "Signal ingest",
        description: `Ingested ${items.length} webhook signal(s): ${parts}.`,
      });
      return items.length;
    } catch (err) {
      console.warn("[useSignalIngest] pull failed:", err);
      return 0;
    }
  }, [upsertSignals, projects, recordActivity]);

  const triggerHeartbeat = useCallback(async (): Promise<void> => {
    try {
      await fetch("/api/cron/heartbeat", { method: "POST" });
    } catch {
      // Non-fatal — heartbeats also run via Vercel cron.
    }
  }, []);

  const pullRef = useRef(pullSignalIngest);
  pullRef.current = pullSignalIngest;
  const heartbeatRef = useRef(triggerHeartbeat);
  heartbeatRef.current = triggerHeartbeat;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void pullRef.current();
    void heartbeatRef.current();

    const drainTimer = setInterval(() => void pullRef.current(), DRAIN_INTERVAL_MS);
    const heartbeatTimer = setInterval(
      () => void heartbeatRef.current(),
      HEARTBEAT_INTERVAL_MS,
    );
    return () => {
      clearInterval(drainTimer);
      clearInterval(heartbeatTimer);
    };
  }, []);

  return { pullSignalIngest };
}
