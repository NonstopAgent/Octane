"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { EmptyState } from "@/components/modules";
import { ActionProposalCard } from "@/components/modules/actions/action-proposal-card";
import { PageHeader } from "@/components/layout/page-header";
import { useOctaneStore } from "@/lib/store/octane-store";
import type {
  OctaneAction,
  OctaneActionRiskLevel,
  OctaneActionSource,
} from "@/lib/types/octane-action";

const SOURCE_ORDER: OctaneActionSource[] = [
  "vercel",
  "gmail",
  "github",
  "advisor",
  "manual",
];

const RISK_ORDER: OctaneActionRiskLevel[] = [
  "critical",
  "high",
  "medium",
  "low",
];

function riskRank(level: OctaneActionRiskLevel | undefined): number {
  if (!level) return RISK_ORDER.length;
  const idx = RISK_ORDER.indexOf(level);
  return idx === -1 ? RISK_ORDER.length : idx;
}

function groupPendingActions(actions: OctaneAction[]) {
  const bySource = new Map<OctaneActionSource, OctaneAction[]>();
  for (const action of actions) {
    const list = bySource.get(action.source) ?? [];
    list.push(action);
    bySource.set(action.source, list);
  }

  return SOURCE_ORDER.filter((source) => bySource.has(source)).map((source) => {
    const items = [...(bySource.get(source) ?? [])].sort(
      (a, b) => riskRank(a.riskLevel) - riskRank(b.riskLevel),
    );
    const byRisk = new Map<OctaneActionRiskLevel | "unspecified", OctaneAction[]>();
    for (const action of items) {
      const key = action.riskLevel ?? "unspecified";
      const bucket = byRisk.get(key) ?? [];
      bucket.push(action);
      byRisk.set(key, bucket);
    }
    const riskGroups = [
      ...RISK_ORDER.filter((r) => byRisk.has(r)).map((r) => ({
        risk: r,
        actions: byRisk.get(r) ?? [],
      })),
      ...(byRisk.has("unspecified")
        ? [{ risk: "unspecified" as const, actions: byRisk.get("unspecified") ?? [] }]
        : []),
    ];
    return { source, riskGroups };
  });
}

const SOURCE_HEADINGS: Record<OctaneActionSource, string> = {
  vercel: "Vercel deployments",
  gmail: "Gmail risk",
  github: "GitHub",
  advisor: "Ask Octane / Chat",
  manual: "Manual & ops",
};

export default function ActionsPage() {
  const octaneActions = useOctaneStore((s) => s.octaneActions);
  const approveOctaneAction = useOctaneStore((s) => s.approveOctaneAction);
  const rejectOctaneAction = useOctaneStore((s) => s.rejectOctaneAction);

  const pending = useMemo(
    () => octaneActions.filter((a) => a.status === "pending"),
    [octaneActions],
  );
  const grouped = useMemo(() => groupPendingActions(pending), [pending]);
  const history = useMemo(
    () =>
      octaneActions
        .filter((a) => a.status !== "pending")
        .slice(0, 24),
    [octaneActions],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Actions"
        description="Operational approval queue — grouped by signal source and risk. Nothing runs until you approve."
      />

      {pending.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No pending approvals"
          description="Critical Vercel or Gmail signals auto-propose mitigations here. Ask Octane can propose tasks and GitHub issues."
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(({ source, riskGroups }) => (
            <section key={source} className="space-y-4">
              <h2 className="text-sm font-medium text-zinc-300">
                {SOURCE_HEADINGS[source]}
              </h2>
              {riskGroups.map(({ risk, actions }) => (
                <div key={`${source}-${risk}`} className="space-y-2">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {risk === "unspecified" ? "Unrated" : risk} ({actions.length})
                  </h3>
                  <div className="space-y-2">
                    {actions.map((action) => (
                      <ActionProposalCard
                        key={action.id}
                        action={action}
                        onApprove={approveOctaneAction}
                        onReject={rejectOctaneAction}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {history.length > 0 ? (
        <section className="space-y-3 border-t border-zinc-800/80 pt-6">
          <h2 className="text-sm font-medium text-zinc-400">Recent</h2>
          <div className="space-y-2">
            {history.map((action) => (
              <ActionProposalCard
                key={action.id}
                action={action}
                onApprove={approveOctaneAction}
                onReject={rejectOctaneAction}
              />
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-xs text-zinc-600">
        Ask Octane on{" "}
        <Link href="/outlook#ask-octane" className="text-amber-500 hover:underline">
          Outlook
        </Link>{" "}
        or{" "}
        <Link href="/chat" className="text-amber-500 hover:underline">
          Chat
        </Link>{" "}
        to propose more actions. Live agents on{" "}
        <Link href="/agents" className="text-amber-500 hover:underline">
          Agent Monitor
        </Link>{" "}
        show assigned work and this queue in context.
      </p>
    </div>
  );
}
