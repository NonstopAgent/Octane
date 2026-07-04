"use client";

import { useEffect, useRef } from "react";

import { pushToSupabase } from "@/lib/supabase/sync";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";

const DEBOUNCE_MS = 4000;

/**
 * Auto-persist every workspace change to Supabase (debounced).
 *
 * The existing sync only pushed on setup — so anything created/edited after
 * that lived only in this browser. This closes that gap: as soon as there's a
 * real Supabase session, every change is durably saved. Without a session,
 * pushToSupabase no-ops (returns "Not authenticated"), so this is safe/inert.
 */
export function useAutoSync() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = useOctaneStore.subscribe(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const persisted = selectOctanePersistedState(useOctaneStore.getState());
        void pushToSupabase(persisted).catch(() => {
          // Silent — durability is best-effort; local cache is the fallback.
        });
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
}
