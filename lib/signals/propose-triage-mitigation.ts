import { actionDedupeKey } from "@/lib/types/octane-action";
import type {
  OctaneAction,
  OctaneActionRiskLevel,
} from "@/lib/types/octane-action";
import type { SignalSeverity, SignalTriageAnalysis } from "@/lib/types/signal";

import type {
  TriageClusterRequest,
  TriageClusterSignalInput,
} from "./triage-analysis";

const SEVERITY_RANK: Record<SignalSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function clusterFocusTitle(cluster: TriageClusterRequest): string {
  if (cluster.signals.length === 0) return "Signal cluster";
  if (cluster.signals.length === 1) return cluster.signals[0].title;
  const primary =
    cluster.signals.find((s) => s.severity === "critical") ??
    cluster.signals.find((s) => s.severity === "high") ??
    cluster.signals[0];
  const extra = cluster.signals.length - 1;
  return extra > 0 ? `${primary.title} (+${extra} related)` : primary.title;
}

export function maxClusterSeverity(
  signals: TriageClusterSignalInput[],
): OctaneActionRiskLevel {
  let best: OctaneActionRiskLevel = "low";
  for (const s of signals) {
    if (!s.severity) continue;
    if (SEVERITY_RANK[s.severity] < SEVERITY_RANK[best]) {
      best = s.severity;
    }
  }
  return signals.some((s) => s.severity) ? best : "medium";
}

export type TriageMitigationProposal = Omit<
  OctaneAction,
  "id" | "status" | "createdAt"
>;

export function buildTriageMitigationProposal(
  cluster: TriageClusterRequest,
  analysis: SignalTriageAnalysis,
): TriageMitigationProposal {
  const focus = clusterFocusTitle(cluster);
  const projectId = cluster.signals.find((s) => s.projectId)?.projectId;

  return {
    type: "create_task",
    title: `Mitigation Plan: ${focus}`,
    description: analysis.structuredMitigationStep,
    payload: {
      signalIds: analysis.signalIds,
      clusterFocus: focus,
      rootCauseEstimate: analysis.rootCauseEstimate,
      operationalImpact: analysis.operationalImpact,
    },
    source: "system",
    riskLevel: maxClusterSeverity(cluster.signals),
    projectId,
  };
}

export function hasPendingSystemMitigation(
  actions: OctaneAction[],
  title: string,
): boolean {
  const key = actionDedupeKey({ source: "system", title });
  return actions.some(
    (a) => a.status === "pending" && actionDedupeKey(a) === key,
  );
}

export function proposeTriageMitigationIfNew(
  proposeAction: (data: TriageMitigationProposal) => OctaneAction,
  actions: OctaneAction[],
  cluster: TriageClusterRequest,
  analysis: SignalTriageAnalysis,
): OctaneAction | null {
  const proposal = buildTriageMitigationProposal(cluster, analysis);
  if (hasPendingSystemMitigation(actions, proposal.title)) return null;
  return proposeAction(proposal);
}
