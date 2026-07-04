"use client";

import { useEffect } from "react";

import { useOctaneStore } from "@/lib/store/octane-store";

/** Map real server env keys → the connection record they back. */
const KEY_TO_CONNECTION: Record<string, string> = {
  GITHUB_TOKEN: "conn-github",
  VERCEL_TOKEN: "conn-vercel",
  ANTHROPIC_API_KEY: "conn-anthropic",
};

/**
 * The store ships placeholder "not_connected" connection records. But GitHub,
 * Vercel, and Anthropic are actually wired via server env. This reconciles the
 * store to reality (from /api/integrations/env-audit) so the dashboard stat,
 * the signal engine, and the AI brief stop reporting "not connected / flying
 * blind" for integrations that are live.
 */
export function useConnectionReconcile() {
  const updateConnection = useOctaneStore((s) => s.updateConnection);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/integrations/env-audit");
        if (!res.ok) return;
        const data = (await res.json()) as {
          keys?: { key: string; configured: boolean }[];
        };
        if (cancelled || !data.keys) return;
        const { connections } = useOctaneStore.getState();
        for (const entry of data.keys) {
          const connId = KEY_TO_CONNECTION[entry.key];
          if (!connId) continue;
          const conn = connections.find((c) => c.id === connId);
          const desired = entry.configured ? "connected" : "not_connected";
          if (conn && conn.status !== desired) {
            updateConnection(connId, { status: desired });
          }
        }
      } catch {
        // best-effort — leave connection state as-is on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [updateConnection]);
}
