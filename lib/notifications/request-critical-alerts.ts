"use client";

import { useOctaneStore } from "@/lib/store/octane-store";
import type { Signal } from "@/lib/types/signal";

import { criticalAlertsFromSignals } from "./dispatcher";

/**
 * Client helper — forwards critical alert payloads to the server dispatch route.
 * WEBHOOK_ALERT_URL stays server-only.
 */
export async function requestCriticalAlertDispatch(
  signals: Signal[],
): Promise<void> {
  const alerts = criticalAlertsFromSignals(signals);
  if (alerts.length === 0) return;

  const results = await Promise.all(
    alerts.map(async (payload) => {
      try {
        const res = await fetch("/api/notifications/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return null;
        return (await res.json()) as { channel?: string; skipped?: boolean };
      } catch {
        return null;
      }
    }),
  );

  const placeholderCount = results.filter(
    (r) => r?.channel === "placeholder" && !r.skipped,
  ).length;
  if (placeholderCount > 0) {
    useOctaneStore.getState().recordActivity({
      action: "updated",
      entityType: "system",
      entityId: "alerts",
      entityName: "Critical alerts",
      description: `Outbound alert placeholder logged for ${placeholderCount} critical signal(s) (WEBHOOK_ALERT_URL not set).`,
    });
  }
}
