"use client";

import { useEffect, useRef } from "react";

import {
  loadCompanyContext,
  pushCompanyContext,
} from "@/lib/supabase/company-sync";
import { useCompanyStore } from "@/lib/store/company-store";

const DEBOUNCE_MS = 4000;

/**
 * Keep the company context (the AI's brain) durable in Supabase:
 * load the cloud copy on mount (adopt only if newer than local edits), then
 * push every edit. No-ops without a Supabase session.
 */
export function useCompanySync() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    async function loadOnce() {
      if (loadedRef.current) return;
      loadedRef.current = true;
      try {
        const cloud = await loadCompanyContext();
        if (!cloud) return;
        const local = useCompanyStore.getState();
        const localTime = local.updatedAt ? Date.parse(local.updatedAt) : 0;
        const cloudTime = cloud.updatedAt ? Date.parse(cloud.updatedAt) : 0;
        if (cloudTime > localTime && cloud.content.trim()) {
          useCompanyStore.setState({
            context: cloud.content,
            updatedAt: cloud.updatedAt,
          });
        }
      } catch {
        // ignore — local cache is the fallback
      } finally {
        // Back up the current context on load so the brain persists even if it's
        // never edited this session (subscribe only fires on change).
        void pushCompanyContext(useCompanyStore.getState().context).catch(
          () => {},
        );
      }
    }
    void loadOnce();

    const unsubscribe = useCompanyStore.subscribe((state) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void pushCompanyContext(state.context).catch(() => {});
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
}
