import type { OctanePersistedState } from "@/lib/store/octane-store";
import type { Signal } from "@/lib/types/signal";
import { isPendingOctaneAction } from "@/lib/types/octane-action";

/**
 * Operational score penalties (back-propagation from signals & actions).
 *
 * Calibrated weights (max ~35 pts total before clamp):
 * - Pending high/critical Octane actions: 8 pts each, cap 16
 * - Active critical Vercel deployment failures: 12 pts each, cap 24
 * - Untriaged critical/high signals (status new): 6 critical + 3 high, cap 18
 */
export type OperationalPenaltyBreakdown = {
  pendingRiskActions: number;
  vercelFailureSignals: number;
  untriagedSignals: number;
};

export type OperationalPenalties = {
  total: number;
  breakdown: OperationalPenaltyBreakdown;
  reasons: string[];
};

const MAX_ACTION_PENALTY = 16;
const MAX_VERCEL_PENALTY = 24;
const MAX_SIGNAL_PENALTY = 18;
const MAX_TOTAL = 35;

function isUnresolvedSignal(signal: Signal): boolean {
  return signal.status !== "resolved" && signal.status !== "dismissed";
}

function isUntriagedHighSignal(signal: Signal): boolean {
  return (
    isUnresolvedSignal(signal) &&
    signal.status === "new" &&
    (signal.severity === "critical" || signal.severity === "high")
  );
}

function isActiveVercelFailure(signal: Signal): boolean {
  return (
    signal.source === "vercel" &&
    signal.type === "deployment" &&
    signal.severity === "critical" &&
    isUnresolvedSignal(signal)
  );
}

export function computeOperationalPenalties(
  state: Pick<OctanePersistedState, "octaneActions" | "signals">,
): OperationalPenalties {
  const signals = state.signals ?? [];
  const actions = state.octaneActions ?? [];

  const pendingRiskActions = actions.filter(
    (a) =>
      isPendingOctaneAction(a) &&
      (a.riskLevel === "critical" || a.riskLevel === "high"),
  ).length;

  const vercelFailureSignals = signals.filter(isActiveVercelFailure).length;

  const untriagedCritical = signals.filter(
    (s) => isUntriagedHighSignal(s) && s.severity === "critical",
  ).length;
  const untriagedHigh = signals.filter(
    (s) => isUntriagedHighSignal(s) && s.severity === "high",
  ).length;

  const actionPts = Math.min(MAX_ACTION_PENALTY, pendingRiskActions * 8);
  const vercelPts = Math.min(MAX_VERCEL_PENALTY, vercelFailureSignals * 12);
  const signalPts = Math.min(
    MAX_SIGNAL_PENALTY,
    untriagedCritical * 6 + untriagedHigh * 3,
  );

  const breakdown: OperationalPenaltyBreakdown = {
    pendingRiskActions: actionPts,
    vercelFailureSignals: vercelPts,
    untriagedSignals: signalPts,
  };

  const total = Math.min(
    MAX_TOTAL,
    breakdown.pendingRiskActions +
      breakdown.vercelFailureSignals +
      breakdown.untriagedSignals,
  );

  const reasons: string[] = [];
  if (pendingRiskActions > 0) {
    reasons.push(
      `${pendingRiskActions} pending approval${pendingRiskActions === 1 ? "" : "s"} at high/critical risk (−${breakdown.pendingRiskActions}).`,
    );
  }
  if (vercelFailureSignals > 0) {
    reasons.push(
      `${vercelFailureSignals} active Vercel deployment failure${vercelFailureSignals === 1 ? "" : "s"} (−${breakdown.vercelFailureSignals}).`,
    );
  }
  const untriagedCount = untriagedCritical + untriagedHigh;
  if (untriagedCount > 0) {
    reasons.push(
      `${untriagedCount} untriaged critical/high signal${untriagedCount === 1 ? "" : "s"} (−${breakdown.untriagedSignals}).`,
    );
  }

  return { total, breakdown, reasons };
}
