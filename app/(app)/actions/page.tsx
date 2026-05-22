"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ClipboardList, History, X } from "lucide-react";

import { EmptyState } from "@/components/modules";
import { ActionProposalCard } from "@/components/modules/actions/action-proposal-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useOctaneStore } from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";
import type {
  OctaneAction,
  OctaneActionRiskLevel,
  OctaneActionSource,
} from "@/lib/types/octane-action";

// ─── Sorting / grouping helpers ───────────────────────────────────────────────

const SOURCE_ORDER: OctaneActionSource[] = [
  "vercel",
  "gmail",
  "system",
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

const SOURCE_HEADINGS: Record<OctaneActionSource, string> = {
  vercel: "Vercel deployments",
  gmail: "Gmail risk",
  system: "Triage synthesis",
  github: "GitHub",
  advisor: "Ask Octane / Chat",
  manual: "Manual & ops",
};

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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "pending" | "history";

export default function ActionsPage() {
  const octaneActions = useOctaneStore((s) => s.octaneActions);
  const approveOctaneAction = useOctaneStore((s) => s.approveOctaneAction);
  const rejectOctaneAction = useOctaneStore((s) => s.rejectOctaneAction);

  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  // Derived lists
  const pending = useMemo(
    () => octaneActions.filter((a) => a.status === "pending"),
    [octaneActions],
  );
  const grouped = useMemo(() => groupPendingActions(pending), [pending]);
  const history = useMemo(
    () =>
      octaneActions
        .filter((a) => a.status !== "pending")
        .slice(0, 40),
    [octaneActions],
  );

  // Clear selection when switching tabs
  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeTab]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  function handleBulkApprove() {
    const count = selectedIds.size;
    for (const id of selectedIds) {
      approveOctaneAction(id);
    }
    setSelectedIds(new Set());
    setToast(`Approved ${count} action${count !== 1 ? "s" : ""}`);
  }

  function handleBulkReject() {
    const count = selectedIds.size;
    for (const id of selectedIds) {
      rejectOctaneAction(id);
    }
    setSelectedIds(new Set());
    setToast(`Dismissed ${count} action${count !== 1 ? "s" : ""}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Actions"
        description="Operational approval queue — grouped by signal source and risk. Nothing runs until you approve."
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-800/80 pb-px">
        <TabButton
          active={activeTab === "pending"}
          onClick={() => setActiveTab("pending")}
          count={pending.length}
        >
          Pending Queue
        </TabButton>
        <TabButton
          active={activeTab === "history"}
          onClick={() => setActiveTab("history")}
          count={history.length}
        >
          History Ledger
        </TabButton>
      </div>

      {/* ── Pending tab ───────────────────────────────────────────────────── */}
      {activeTab === "pending" && (
        <>
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
                            isSelected={selectedIds.has(action.id)}
                            onToggleSelect={toggleSelect}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── History tab ───────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <>
          {history.length === 0 ? (
            <EmptyState
              icon={History}
              title="No action history"
              description="Approved and rejected actions will appear here for reference."
            />
          ) : (
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
          )}
        </>
      )}

      {/* Footer */}
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

      {/* ── Floating bulk toolbar ─────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 z-50 -translate-x-1/2",
            "flex items-center gap-2 rounded-xl border border-zinc-700/70",
            "bg-zinc-900/90 px-4 py-2.5 shadow-xl backdrop-blur-md",
          )}
        >
          <span className="mr-1 text-sm text-zinc-400">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-700 hover:bg-emerald-600"
            onClick={handleBulkApprove}
          >
            <Check className="size-3.5" />
            Approve all
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-zinc-600"
            onClick={handleBulkReject}
          >
            <X className="size-3.5" />
            Dismiss all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-zinc-400 hover:text-zinc-100"
            onClick={() => setSelectedIds(new Set())}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* ── Toast notification ────────────────────────────────────────────── */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50",
            "rounded-lg border border-zinc-700/60 bg-zinc-800/95 px-4 py-2.5",
            "text-sm text-zinc-200 shadow-xl backdrop-blur-md",
          )}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── TabButton ────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
        "border-b-2 -mb-px",
        active
          ? "border-amber-500 text-zinc-100"
          : "border-transparent text-zinc-500 hover:text-zinc-300",
      )}
    >
      {children}
      {count > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs font-medium leading-none",
            active
              ? "bg-amber-500/20 text-amber-300"
              : "bg-zinc-800 text-zinc-500",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
