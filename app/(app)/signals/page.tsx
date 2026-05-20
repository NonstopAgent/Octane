"use client";

import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Info,
  RefreshCw,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { generateSignals } from "@/lib/signals/generate-signals";
import {
  useOctaneStore,
  type OctaneStore,
} from "@/lib/store/octane-store";
import type { Signal, SignalSeverity, SignalStatus, SignalType } from "@/lib/types/signal";
import { cn } from "@/lib/utils";

// ─── Severity config ─────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  SignalSeverity,
  { label: string; icon: React.ElementType; className: string; dotClass: string }
> = {
  critical: {
    label: "Critical",
    icon: AlertCircle,
    className: "text-red-400 border-red-900/60 bg-red-950/30",
    dotClass: "bg-red-500",
  },
  high: {
    label: "High",
    icon: AlertTriangle,
    className: "text-orange-400 border-orange-900/60 bg-orange-950/20",
    dotClass: "bg-orange-500",
  },
  medium: {
    label: "Medium",
    icon: CircleDot,
    className: "text-yellow-400 border-yellow-900/60 bg-yellow-950/20",
    dotClass: "bg-yellow-500",
  },
  low: {
    label: "Low",
    icon: Info,
    className: "text-zinc-400 border-zinc-700/60 bg-zinc-900/30",
    dotClass: "bg-zinc-500",
  },
};

const TYPE_LABELS: Record<SignalType, string> = {
  progress: "Progress",
  risk: "Risk",
  blocker: "Blocker",
  opportunity: "Opportunity",
  revenue: "Revenue",
  cost: "Cost",
  deployment: "Deployment",
  task: "Task",
  decision: "Decision",
  document: "Document",
  approval: "Approval",
  agent: "Agent",
  connection: "Connection",
  note: "Note",
  system: "System",
};

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabKey = "all" | "action" | "blockers" | "opportunities" | "resolved";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "action", label: "Needs Action" },
  { key: "blockers", label: "Blockers" },
  { key: "opportunities", label: "Opportunities" },
  { key: "resolved", label: "Resolved" },
];

function filterByTab(signals: Signal[], tab: TabKey): Signal[] {
  switch (tab) {
    case "action":
      return signals.filter(
        (s) => s.status === "new" && (s.type === "approval" || s.type === "decision"),
      );
    case "blockers":
      return signals.filter((s) => s.type === "blocker" && s.status !== "resolved" && s.status !== "dismissed");
    case "opportunities":
      return signals.filter((s) => s.type === "opportunity" || s.type === "revenue");
    case "resolved":
      return signals.filter((s) => s.status === "resolved" || s.status === "dismissed");
    case "all":
    default:
      return signals.filter((s) => s.status !== "resolved" && s.status !== "dismissed");
  }
}

// ─── Signal card ─────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  onAcknowledge,
  onResolve,
  onDismiss,
}: {
  signal: Signal;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const cfg = SEVERITY_CONFIG[signal.severity];
  const SeverityIcon = cfg.icon;
  const isNew = signal.status === "new";
  const isResolved =
    signal.status === "resolved" || signal.status === "dismissed";

  // Derive a link to the related record if possible
  const recordLink = useMemo(() => {
    if (!signal.relatedRecordType || !signal.relatedRecordId) return null;
    switch (signal.relatedRecordType) {
      case "project": return `/projects`;
      case "task": return `/tasks`;
      case "decision": return `/decisions`;
      case "agent": return `/agents`;
      default: return null;
    }
  }, [signal.relatedRecordType, signal.relatedRecordId]);

  return (
    <Card
      className={cn(
        "border transition-all",
        isResolved ? "opacity-50" : "hover:border-zinc-700",
        isNew ? "border-l-2 " + cfg.dotClass.replace("bg-", "border-l-") : "border-zinc-800",
        "bg-zinc-900/50",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Severity icon */}
          <div className={cn("mt-0.5 shrink-0", cfg.className.split(" ")[0])}>
            <SeverityIcon className="size-4" />
          </div>

          {/* Body */}
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-zinc-100 leading-snug">
                {signal.title}
              </span>
              <Badge
                variant="outline"
                className="h-4 border-zinc-700 px-1.5 py-0 text-[10px] text-zinc-500"
              >
                {TYPE_LABELS[signal.type] ?? signal.type}
              </Badge>
              {isNew && (
                <span className={cn("size-1.5 rounded-full shrink-0", cfg.dotClass)} />
              )}
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-2">
              {signal.summary}
            </p>
            {signal.recommendedAction && (
              <p className="text-xs text-zinc-500 italic mb-2">
                → {signal.recommendedAction}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] text-zinc-600">
                {formatDistanceToNow(new Date(signal.createdAt), { addSuffix: true })}
              </span>
              {signal.source !== "system" && (
                <span className="text-[10px] text-zinc-700 uppercase tracking-wider">
                  {signal.source}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {!isResolved && (
            <div className="flex shrink-0 flex-col gap-1">
              {recordLink && (
                <Link href={recordLink}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-zinc-400 hover:text-zinc-100"
                    title="View record"
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </Link>
              )}
              {signal.status === "new" && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-zinc-500 hover:text-zinc-300"
                  title="Acknowledge"
                  onClick={() => onAcknowledge(signal.id)}
                >
                  <CheckCircle2 className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 text-zinc-600 hover:text-zinc-400"
                title="Dismiss"
                onClick={() => onDismiss(signal.id)}
              >
                <span className="text-xs">✕</span>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Severity filter bar ──────────────────────────────────────────────────────

function SeverityFilter({
  counts,
  active,
  onChange,
}: {
  counts: Record<SignalSeverity, number>;
  active: SignalSeverity | "all";
  onChange: (v: SignalSeverity | "all") => void;
}) {
  const severities: (SignalSeverity | "all")[] = ["all", "critical", "high", "medium", "low"];
  return (
    <div className="flex gap-1.5 flex-wrap">
      {severities.map((s) => {
        const isAll = s === "all";
        const cfg = isAll ? null : SEVERITY_CONFIG[s as SignalSeverity];
        const count = isAll
          ? Object.values(counts).reduce((a, b) => a + b, 0)
          : counts[s as SignalSeverity];
        const isActive = active === s;
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
              isActive
                ? "border-zinc-500 bg-zinc-800 text-zinc-100"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
            )}
          >
            {cfg && (
              <span className={cn("size-1.5 rounded-full", cfg.dotClass)} />
            )}
            <span className="capitalize">{s === "all" ? "All" : cfg!.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  "rounded px-1 py-0.5 text-[10px] font-medium",
                  isActive ? "bg-zinc-700 text-zinc-200" : "bg-zinc-900 text-zinc-500",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Selector that returns workspace data WITHOUT signals — used as the
// useEffect dependency so that calling upsertSignals() doesn't trigger
// the effect again (breaking the infinite-loop).
function selectWorkspaceForSignals(s: OctaneStore) {
  return {
    profile: s.profile,
    projects: s.projects,
    tasks: s.tasks,
    decisions: s.decisions,
    roadmapItems: s.roadmapItems,
    transactions: s.transactions,
    documents: s.documents,
    ipAssets: s.ipAssets,
    entities: s.entities,
    agents: s.agents,
    activityLogs: s.activityLogs,
    workSessions: s.workSessions,
    inboxItems: s.inboxItems,
    founderNotes: s.founderNotes,
    complianceReminders: s.complianceReminders,
    legalQuestions: s.legalQuestions,
    formationChecklistItems: s.formationChecklistItems,
    agentLogs: s.agentLogs,
    agentRuns: s.agentRuns,
    connections: s.connections,
    octaneActions: s.octaneActions,
    projectConnections: s.projectConnections,
    codingJobs: s.codingJobs,
    // NOTE: signals intentionally excluded — selecting it here would cause
    // upsertSignals() → workspace change → effect re-fires → infinite loop
  };
}

export default function SignalsPage() {
  // workspace = all persisted state EXCEPT signals (avoids the update loop)
  const workspace = useOctaneStore(useShallow(selectWorkspaceForSignals));

  const signals = useOctaneStore((s) => s.signals);
  const upsertSignals = useOctaneStore((s) => s.upsertSignals);
  const updateSignalStatus = useOctaneStore((s) => s.updateSignalStatus);

  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [severityFilter, setSeverityFilter] = useState<SignalSeverity | "all">("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Run generator on mount and when workspace data (not signals) changes
  useEffect(() => {
    const derived = generateSignals({ ...workspace, signals });
    // Preserve existing status for signals already in store
    const existingMap = new Map(signals.map((s) => [s.id, s]));
    const toUpsert = derived.map((s) => {
      const existing = existingMap.get(s.id);
      return existing ? { ...s, status: existing.status } : s;
    });
    upsertSignals(toUpsert);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]); // workspace excludes signals — no loop

  function handleRefresh() {
    const derived = generateSignals({ ...workspace, signals });
    upsertSignals(derived);
    setLastRefresh(new Date());
  }

  function handleAcknowledge(id: string) {
    updateSignalStatus(id, "acknowledged");
  }

  function handleResolve(id: string) {
    updateSignalStatus(id, "resolved");
  }

  function handleDismiss(id: string) {
    updateSignalStatus(id, "dismissed");
  }

  // Apply tab + severity filters
  const displayed = useMemo(() => {
    let list = filterByTab(signals, activeTab);
    if (severityFilter !== "all") {
      list = list.filter((s) => s.severity === severityFilter);
    }
    // Sort: critical → high → medium → low, then newest first
    const ORDER: SignalSeverity[] = ["critical", "high", "medium", "low"];
    list = [...list].sort((a, b) => {
      const sevDiff = ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity);
      if (sevDiff !== 0) return sevDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [signals, activeTab, severityFilter]);

  // Count by severity for the filter bar (from the current tab view before severity filter)
  const severityCounts = useMemo(() => {
    const tabFiltered = filterByTab(signals, activeTab);
    const counts: Record<SignalSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const s of tabFiltered) counts[s.severity]++;
    return counts;
  }, [signals, activeTab]);

  const criticalCount = signals.filter(
    (s) => s.severity === "critical" && s.status !== "resolved" && s.status !== "dismissed",
  ).length;

  const newCount = signals.filter((s) => s.status === "new").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Signals"
        description={
          newCount > 0
            ? `${newCount} new signal${newCount !== 1 ? "s" : ""} require attention`
            : "Your workspace intelligence feed"
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            onClick={handleRefresh}
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        }
      />

      {/* Summary strip */}
      {criticalCount > 0 && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-400 shrink-0" />
            <span className="text-sm font-medium text-red-300">
              {criticalCount} critical signal{criticalCount !== 1 ? "s" : ""} need immediate attention
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
        {TABS.map((tab) => {
          const tabSignals = filterByTab(signals, tab.key);
          const count = tab.key !== "all" ? tabSignals.length : signals.filter(
            (s) => s.status !== "resolved" && s.status !== "dismissed"
          ).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-sm transition-colors",
                activeTab === tab.key
                  ? "border-zinc-400 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300",
              )}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    activeTab === tab.key
                      ? "bg-zinc-700 text-zinc-200"
                      : "bg-zinc-900 text-zinc-600",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Severity filter */}
      <SeverityFilter
        counts={severityCounts}
        active={severityFilter}
        onChange={setSeverityFilter}
      />

      {/* Signal list */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-16 text-center">
          <Zap className="mb-3 size-8 text-zinc-700" />
          <p className="text-sm font-medium text-zinc-400">
            {activeTab === "resolved" ? "No resolved signals" : "No signals in this view"}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            {activeTab === "all"
              ? "Your workspace looks healthy. Signals appear as tasks, projects, and connections need attention."
              : "Adjust the filter or tab to see more signals."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayed.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}

      <p className="text-[10px] text-zinc-700 text-right">
        Last refreshed {formatDistanceToNow(lastRefresh, { addSuffix: true })}
        {" · "}
        {signals.length} total signal{signals.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
