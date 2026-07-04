"use client";

import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { syncSignalActionProposals } from "@/lib/actions/sync-signal-action-proposals";
import {
  buildDisplaySignals,
  selectActiveSignals,
  selectWorkspaceForSignals,
} from "@/lib/signals/workspace-signals";
import { useOctaneStore } from "@/lib/store/octane-store";

const DEBOUNCE_MS = 1500;

/**
 * App-wide proposer. Watches the full display-signal set (derived rules + live
 * GitHub/Gmail/Vercel ingest) and auto-proposes approvable actions into the
 * queue so Actions — and, on approval, Tasks — populate themselves.
 *
 * Debounced to coalesce store churn; dedupe + caps live in
 * syncSignalActionProposals, so re-running is cheap and loop-proof.
 * Mounted once in the app layout.
 */
export function useSignalActionProposals(): void {
  const workspace = useOctaneStore(useShallow(selectWorkspaceForSignals));
  const storedSignals = useOctaneStore((s) => s.signals);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const active = selectActiveSignals(
        buildDisplaySignals(workspace, storedSignals),
      );
      syncSignalActionProposals(useOctaneStore.getState, active);
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [workspace, storedSignals]);
}
