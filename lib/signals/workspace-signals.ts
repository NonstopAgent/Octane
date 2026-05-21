import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { generateSignals } from "@/lib/signals/generate-signals";
import {
  selectOctanePersistedState,
  useOctaneStore,
  type OctaneStore,
} from "@/lib/store/octane-store";
import type { OctanePersistedState } from "@/lib/store/octane-store";
import type { Signal } from "@/lib/types/signal";

/** Workspace snapshot for signal generation (excludes signals to avoid update loops). */
export function selectWorkspaceForSignals(
  state: OctaneStore,
): Omit<OctanePersistedState, "signals"> {
  const { signals: _signals, ...workspace } = selectOctanePersistedState(state);
  return workspace;
}

const TRIAGED_STATUSES = new Set<Signal["status"]>([
  "acknowledged",
  "in_progress",
  "resolved",
  "dismissed",
]);

function isTriaged(status: Signal["status"]): boolean {
  return TRIAGED_STATUSES.has(status);
}

/**
 * Merge freshly derived signals with Gmail-only rows and persisted triage status.
 */
export function buildDisplaySignals(
  workspace: Omit<OctanePersistedState, "signals">,
  storedSignals: Signal[],
): Signal[] {
  const derived = generateSignals(workspace as OctanePersistedState);
  const gmailOnly = storedSignals.filter((s) => s.source === "gmail");
  const byId = new Map<string, Signal>();
  for (const s of derived) byId.set(s.id, s);
  for (const s of gmailOnly) byId.set(s.id, s);

  const statusMap = new Map(storedSignals.map((s) => [s.id, s]));
  return [...byId.values()].map((signal) => {
    const stored = statusMap.get(signal.id);
    if (!stored) return signal;
    return {
      ...signal,
      status: stored.status,
      resolvedAt: stored.resolvedAt,
      updatedAt: stored.updatedAt,
    };
  });
}

/** Signals ready for upsert — preserves user triage on existing rows. */
export function mergeSignalsForUpsert(
  incoming: Signal[],
  storedSignals: Signal[],
): Signal[] {
  const statusMap = new Map(storedSignals.map((s) => [s.id, s]));
  return incoming.map((signal) => {
    const stored = statusMap.get(signal.id);
    if (!stored || !isTriaged(stored.status)) return signal;
    return {
      ...signal,
      status: stored.status,
      resolvedAt: stored.resolvedAt,
      updatedAt: stored.updatedAt,
    };
  });
}

export function useDisplaySignals(): Signal[] {
  const workspace = useOctaneStore(useShallow(selectWorkspaceForSignals));
  const storedSignals = useOctaneStore((s) => s.signals);
  return useMemo(
    () => buildDisplaySignals(workspace, storedSignals),
    [workspace, storedSignals],
  );
}

export function selectActiveSignals(signals: Signal[]): Signal[] {
  return signals.filter(
    (s) => s.status !== "resolved" && s.status !== "dismissed",
  );
}
