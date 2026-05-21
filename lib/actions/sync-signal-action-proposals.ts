import { actionDedupeKey } from "@/lib/types/octane-action";
import type { OctaneActionRiskLevel } from "@/lib/types/octane-action";
import type { OctaneStore } from "@/lib/store/octane-store";
import type { Signal } from "@/lib/types/signal";

function riskFromSeverity(severity: Signal["severity"]): OctaneActionRiskLevel {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  return "medium";
}

/**
 * Auto-propose mitigation actions for critical/high Gmail and Vercel signals.
 * Dedupes on source + title while an identical proposal is still pending.
 */
export function syncSignalActionProposals(
  get: () => OctaneStore,
  signals: Signal[],
): void {
  const store = get();
  const pendingKeys = new Set(
    store.octaneActions
      .filter((a) => a.status === "pending")
      .map((a) => actionDedupeKey(a)),
  );

  for (const signal of signals) {
    if (signal.source !== "gmail" && signal.source !== "vercel") continue;
    if (signal.severity !== "critical" && signal.severity !== "high") continue;

    const title = `Mitigate: ${signal.title}`;
    const source = signal.source;
    const key = `${source}:${title}`;
    if (pendingKeys.has(key)) continue;

    const mitigation =
      signal.recommendedAction?.trim() ||
      "Review signal in Signals, triage, and approve a follow-up task or GitHub issue.";

    store.proposeAction({
      type: "create_task",
      title,
      description: `${signal.summary}\n\nMitigation: ${mitigation}`,
      payload: {
        signalId: signal.id,
        mitigation,
        title: title.replace(/^Mitigate:\s*/i, ""),
      },
      source,
      riskLevel: riskFromSeverity(signal.severity),
      projectId: signal.projectId,
    });
    pendingKeys.add(key);
  }
}
