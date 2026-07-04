"use client";

import { useCallback, useEffect, useState, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckSquare,
  ChevronRight,
  Clock,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import { CeoBrief } from "@/components/modules/ceo-brief";
import { DashboardCodingCards } from "@/components/modules/coding/dashboard-coding-cards";
import { DashboardIntegrationHealth } from "@/components/modules/connections/dashboard-integration-health";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SandboxCommsBadge } from "@/components/modules/signals/sandbox-comms-badge";
import { useGmailSignals } from "@/lib/hooks/use-gmail-signals";
import { useVercelSignals } from "@/lib/hooks/use-vercel-signals";
import { useGithubSignals } from "@/lib/hooks/use-github-signals";
import {
  buildDisplaySignals,
  selectActiveSignals,
  selectWorkspaceForSignals,
} from "@/lib/signals/workspace-signals";
import { taskDraftFromSignal } from "@/lib/signals/signal-to-task";
import { computeOctaneScore } from "@/lib/scoring/octane-score";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";
import type { Signal } from "@/lib/types/signal";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RepoData {
  name: string;
  description: string | null;
  stars: number;
  openIssues: number;
  language: string | null;
  defaultBranch: string;
  visibility: string;
  pushedAt: string | null;
  lastCommit: {
    sha: string;
    message: string;
    author: string;
    date: string;
    url: string;
  } | null;
  openPRs: { number: number; title: string; url: string; author: string }[];
}

// ─── Repo Status Card ─────────────────────────────────────────────────────────

function RepoStatusCard({
  repo,
  label,
  emoji,
}: {
  repo: string;
  label: string;
  emoji: string;
}) {
  const [data, setData] = useState<RepoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/github/repo?repo=${repo}`)
      .then((r) => r.json())
      .then((d: RepoData) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [repo]);

  const pushedAgo = data?.pushedAt
    ? formatDistanceToNow(new Date(data.pushedAt), { addSuffix: true })
    : null;

  const commitAgo = data?.lastCommit?.date
    ? formatDistanceToNow(new Date(data.lastCommit.date), { addSuffix: true })
    : null;

  return (
    <Card className="glass rounded-2xl border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-zinc-100 text-base">
            <span className="text-xl">{emoji}</span>
            {label}
          </CardTitle>
          <a
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
        <p className="text-[11px] text-zinc-600 font-mono">{repo}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3 rounded bg-zinc-800/60 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs text-zinc-500">
            Could not reach GitHub. Add GITHUB_TOKEN for better rate limits.
          </p>
        )}

        {data && !loading && (
          <>
            {/* Stats bar */}
            <div className="flex gap-3">
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <GitBranch className="size-3" />
                {data.defaultBranch}
              </span>
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <AlertCircle className="size-3" />
                {data.openIssues} {data.openIssues === 1 ? "issue" : "issues"}
              </span>
              <span className="flex items-center gap-1 text-xs text-zinc-400">
                <GitPullRequest className="size-3" />
                {data.openPRs.length} {data.openPRs.length === 1 ? "PR" : "PRs"}
              </span>
              {data.language && (
                <span className="text-xs text-zinc-600">{data.language}</span>
              )}
            </div>

            {/* Last commit */}
            {data.lastCommit ? (
              <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-200 truncate">
                      {data.lastCommit.message}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {data.lastCommit.author} · {commitAgo}
                    </p>
                  </div>
                  <a
                    href={data.lastCommit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 font-mono text-[10px] text-zinc-600 hover:text-amber-400 transition-colors"
                  >
                    {data.lastCommit.sha}
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-600">No commits yet</p>
            )}

            {/* Open PRs */}
            {data.openPRs.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                  Open PRs
                </p>
                {data.openPRs.slice(0, 3).map((pr) => (
                  <a
                    key={pr.number}
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <GitMerge className="size-3 shrink-0 text-purple-400" />
                    <span className="truncate">{pr.title}</span>
                    <span className="shrink-0 text-zinc-600">#{pr.number}</span>
                  </a>
                ))}
              </div>
            )}

            {/* Activity pulse */}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "size-1.5 rounded-full",
                  pushedAgo && !pushedAgo.includes("month") && !pushedAgo.includes("year")
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-zinc-600",
                )}
              />
              <p className="text-[11px] text-zinc-600">
                Last push {pushedAgo ?? "unknown"}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Layout primitives ────────────────────────────────────────────────────────

/** Unified glass panel with a consistent header — the single card system. */
function Panel({
  title,
  icon: Icon,
  iconClass = "text-zinc-400",
  action,
  className,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconClass?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("glass rounded-2xl p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-200">
          {Icon ? <Icon className={cn("size-4", iconClass)} /> : null}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const METRIC_TONES: Record<string, string> = {
  none: "text-zinc-50",
  red: "text-red-300",
  amber: "text-amber-300",
  orange: "text-orange-300",
  violet: "text-violet-300",
};

/** Compact metric used inside the "At a glance" cluster. */
function Metric({
  href,
  value,
  label,
  tone = "none",
}: {
  href?: string;
  value: ReactNode;
  label: string;
  tone?: keyof typeof METRIC_TONES;
}) {
  const inner = (
    <div className="h-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 transition-colors hover:bg-white/[0.05]">
      <p className={cn("text-2xl font-semibold tabular-nums tracking-tight", METRIC_TONES[tone])}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** Header KPI pill. */
function HeaderStat({
  href,
  value,
  label,
  tone = "text-zinc-50",
}: {
  href?: string;
  value: ReactNode;
  label: string;
  tone?: string;
}) {
  const inner = (
    <div className="glass min-w-[86px] rounded-xl px-4 py-2 text-center transition-all hover:ring-1 hover:ring-inset hover:ring-white/15">
      <p className={cn("text-xl font-semibold tabular-nums leading-tight", tone)}>{value}</p>
      <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));
  const workspace = useOctaneStore(useShallow(selectWorkspaceForSignals));
  const storedSignals = useOctaneStore((s) => s.signals);
  const setPendingChatContext = useOctaneStore((s) => s.setPendingChatContext);
  const createTask = useOctaneStore((s) => s.createTask);
  const updateSignalStatus = useOctaneStore((s) => s.updateSignalStatus);
  const { refreshGmailSignals, lastProvenance } = useGmailSignals();
  const { refreshVercelSignals } = useVercelSignals();
  const { refreshGithubSignals } = useGithubSignals();
  const router = useRouter();

  useEffect(() => {
    void refreshGmailSignals();
    void refreshVercelSignals();
    void refreshGithubSignals();
  }, [refreshGmailSignals, refreshVercelSignals, refreshGithubSignals]);

  const handleDashboardAskAdvisor = useCallback(
    (signal: Signal) => {
      const parts = [
        `I need strategic guidance on an active ${signal.severity} severity signal:`,
        `**Signal:** ${signal.title}`,
        `**Summary:** ${signal.summary}`,
        `**Source:** ${signal.source}`,
        `**Severity:** ${signal.severity}`,
      ];
      if (signal.recommendedAction) {
        parts.push(`**Recommended action:** ${signal.recommendedAction}`);
      }
      parts.push(`What's your assessment and recommended response?`);
      setPendingChatContext(parts.join("\n"));
      router.push("/chat?context=1");
    },
    [setPendingChatContext, router],
  );

  const handleCreateTaskFromSignal = useCallback(
    (signal: Signal) => {
      const draft = taskDraftFromSignal(signal);
      const task = createTask(draft);
      updateSignalStatus(signal.id, "acknowledged");
      toast.success(`Task created: ${task.title}`, {
        description: "Added to Tasks — marked this signal acknowledged.",
      });
    },
    [createTask, updateSignalStatus],
  );

  const openTasks = useMemo(
    () => state.tasks.filter((t) => t.status !== "done"),
    [state.tasks],
  );
  const criticalTasks = useMemo(
    () => openTasks.filter((t) => t.priority === "critical"),
    [openTasks],
  );
  const blockedTasks = useMemo(
    () => openTasks.filter((t) => t.status === "blocked"),
    [openTasks],
  );
  const activeProjects = useMemo(
    () => state.projects.filter((p) =>
      p.status === "building" || p.status === "testing" || p.status === "launched"
    ),
    [state.projects],
  );

  const topSignals = useMemo<Signal[]>(() => {
    const all = selectActiveSignals(
      buildDisplaySignals(workspace, storedSignals),
    );
    const ORDER = ["critical", "high", "medium", "low"] as const;
    return all
      .filter((s) => s.severity !== "low")
      .sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
      .slice(0, 5);
  }, [workspace, storedSignals]);

  const octaneScore = useMemo(() => computeOctaneScore(state), [state]);

  const pendingApprovals = state.octaneActions.filter(
    (a) => a.status === "pending",
  ).length;
  const connectedCount = state.connections.filter(
    (c) => c.status === "connected",
  ).length;
  const missingLinkCount = state.projects.filter(
    (p) => !state.projectConnections.some((pc) => pc.projectId === p.id),
  ).length;

  const profileName = state.profile?.name ?? "Logan";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6 pb-16">
      {/* Header row */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-gradient text-[2rem] font-semibold leading-tight tracking-tight">
            {greeting}, {profileName}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Live status across Octane Ajax, Nexus, and your open work.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:flex">
          <HeaderStat
            href="/briefing"
            value={octaneScore.score}
            label="Score"
            tone={octaneScore.score < 60 ? "text-orange-300" : "text-zinc-50"}
          />
          <HeaderStat
            href="/actions"
            value={pendingApprovals}
            label="Pending"
            tone={pendingApprovals > 0 ? "text-violet-300" : "text-zinc-50"}
          />
          <HeaderStat href="/tasks" value={openTasks.length} label="Open" />
        </div>
      </div>

      {/* Hero: brief + command-score rail */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CeoBrief />
        </div>
        <div className="flex flex-col gap-5">
          <Panel title="Command score" icon={Activity} iconClass="text-violet-300">
            <div className="flex items-end gap-2">
              <span className="text-gradient text-5xl font-semibold leading-none tabular-nums">
                {octaneScore.score}
              </span>
              <span className="mb-1 text-xs text-zinc-500">/ 100</span>
            </div>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-fuchsia-400 to-violet-400"
                style={{ width: `${octaneScore.score}%` }}
              />
            </div>
            {octaneScore.operationalPenaltyReasons.length > 0 ? (
              <p className="mt-3 text-[11px] leading-relaxed text-orange-300">
                −{octaneScore.breakdown.operationalPenalty} operational ·{" "}
                <span className="text-zinc-500">
                  {octaneScore.operationalPenaltyReasons[0]}
                </span>
              </p>
            ) : (
              <p className="mt-3 text-[11px] text-zinc-500">
                No operational drag on the score.
              </p>
            )}
          </Panel>

          <Link
            href="/outlook#ask-octane"
            className="glass rounded-2xl p-5 transition-all hover:ring-1 hover:ring-inset hover:ring-violet-400/30"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <Sparkles className="size-4 text-amber-400" aria-hidden />
              Ask Octane
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Executive questions on risks, focus, and portfolio outlook.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-300">
              Open advisor <ChevronRight className="size-3.5" />
            </span>
          </Link>
        </div>
      </div>

      {/* Signals + at-a-glance */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Signals"
          icon={Zap}
          iconClass="text-amber-400"
          action={
            <div className="flex items-center gap-2">
              {lastProvenance === "mock" && <SandboxCommsBadge />}
              <Link
                href="/signals"
                className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-100"
              >
                View all <ChevronRight className="size-3" />
              </Link>
            </div>
          }
        >

        {topSignals.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800/50 bg-zinc-900/20 px-3 py-2.5">
            <ShieldCheck className="size-3.5 shrink-0 text-emerald-500/70" />
            <p className="text-xs text-zinc-500">
              ▪ Portfolio Infrastructure Stable — All monitoring systems clear.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {topSignals.map((signal) => {
              const isCritical = signal.severity === "critical";
              return (
                <div
                  key={signal.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                    isCritical
                      ? "border-red-900/50 bg-red-950/20 hover:bg-red-950/30"
                      : "border-orange-900/40 bg-orange-950/10 hover:bg-orange-950/20",
                  )}
                >
                  {isCritical ? (
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-orange-400" />
                  )}
                  <Link
                    href="/signals"
                    className="min-w-0 flex-1 transition-opacity hover:opacity-80"
                  >
                    <p
                      className={cn(
                        "truncate text-xs font-semibold",
                        isCritical ? "text-red-300" : "text-orange-300",
                      )}
                    >
                      {signal.title}
                    </p>
                    <p className="truncate text-[11px] text-zinc-400">{signal.summary}</p>
                    {signal.recommendedAction ? (
                      <p className="mt-0.5 truncate text-[11px] text-amber-400">
                        → {signal.recommendedAction}
                      </p>
                    ) : null}
                  </Link>
                  <button
                    type="button"
                    title="Create a task from this"
                    onClick={() => handleCreateTaskFromSignal(signal)}
                    className="mt-0.5 shrink-0 text-zinc-600 transition-colors hover:text-emerald-400"
                  >
                    <CheckSquare className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Ask Advisor"
                    onClick={() => handleDashboardAskAdvisor(signal)}
                    className="mt-0.5 shrink-0 text-zinc-600 transition-colors hover:text-amber-400"
                  >
                    <MessageSquare className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        </Panel>

        <Panel title="At a glance" icon={Activity} iconClass="text-emerald-400">
          <div className="grid grid-cols-2 gap-2.5">
            <Metric
              href="/actions"
              value={pendingApprovals}
              label="Pending approvals"
              tone={pendingApprovals > 0 ? "violet" : "none"}
            />
            <Metric href="/tasks" value={openTasks.length} label="Open tasks" />
            <Metric
              value={criticalTasks.length}
              label="Critical"
              tone={criticalTasks.length > 0 ? "red" : "none"}
            />
            <Metric
              value={blockedTasks.length}
              label="Blocked"
              tone={blockedTasks.length > 0 ? "amber" : "none"}
            />
            <Metric
              href="/connections"
              value={
                <>
                  {connectedCount}
                  <span className="text-sm font-normal text-zinc-500">
                    /{state.connections.length}
                  </span>
                </>
              }
              label="Connected"
            />
            <Metric href="/projects" value={missingLinkCount} label="Missing links" />
          </div>
        </Panel>
      </div>

      <DashboardCodingCards />

      {/* Portfolio */}
      <div>
        <div className="mb-3 flex items-center gap-2 px-1">
          <GitBranch className="size-4 text-violet-300" />
          <h2 className="text-[13px] font-semibold text-zinc-200">
            Portfolio · Live repo status
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <RepoStatusCard
            repo="NonstopAgent/Octane_Ajax"
            label="Octane Ajax"
            emoji="🚀"
          />
          <RepoStatusCard
            repo="NonstopAgent/Octane_Nexus"
            label="Octane Nexus"
            emoji="🔭"
          />
          <RepoStatusCard
            repo="NonstopAgent/Octane"
            label="Octane Core"
            emoji="⚡"
          />
          <RepoStatusCard
            repo="NonstopAgent/HedgeFund"
            label="HedgeFund"
            emoji="📈"
          />
        </div>
      </div>

      {/* What needs attention */}
      {(criticalTasks.length > 0 || blockedTasks.length > 0) && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-zinc-400 flex items-center gap-2">
            <AlertCircle className="size-3.5 text-red-400" />
            Needs Attention
          </h2>
          <div className="space-y-2">
            {criticalTasks.slice(0, 5).map((task) => {
              const project = state.projects.find((p) => p.id === task.projectId);
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-lg border border-red-900/40 bg-red-950/10 px-4 py-2.5"
                >
                  <AlertCircle className="size-3.5 shrink-0 text-red-400" />
                  <span className="flex-1 truncate text-sm text-zinc-200">{task.title}</span>
                  {project && (
                    <span className="shrink-0 text-[11px] text-zinc-500">{project.name}</span>
                  )}
                  <Badge variant="outline" className="border-red-800/50 text-red-400 text-[10px] shrink-0">
                    critical
                  </Badge>
                </div>
              );
            })}
            {blockedTasks.slice(0, 3).map((task) => {
              const project = state.projects.find((p) => p.id === task.projectId);
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-lg border border-amber-900/40 bg-amber-950/10 px-4 py-2.5"
                >
                  <Clock className="size-3.5 shrink-0 text-amber-400" />
                  <span className="flex-1 truncate text-sm text-zinc-200">{task.title}</span>
                  {project && (
                    <span className="shrink-0 text-[11px] text-zinc-500">{project.name}</span>
                  )}
                  <Badge variant="outline" className="border-amber-800/50 text-amber-400 text-[10px] shrink-0">
                    blocked
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active projects + agents */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title={`Active projects (${activeProjects.length})`}
          icon={Zap}
          iconClass="text-amber-400"
        >
          {activeProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center">
              <p className="text-sm text-zinc-600">No active projects yet.</p>
              <Link
                href="/outlook#ask-octane"
                className="mt-2 block text-xs text-amber-500 hover:text-amber-400"
              >
                Ask Octane to add projects →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {activeProjects.map((p) => {
                const projectTasks = state.tasks.filter(
                  (t) => t.projectId === p.id && t.status !== "done"
                );
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-zinc-100 text-sm">{p.name}</p>
                      <div className="flex items-center gap-2">
                        {projectTasks.length > 0 && (
                          <span className="text-[11px] text-zinc-500">
                            {projectTasks.length} open {projectTasks.length === 1 ? "task" : "tasks"}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            p.status === "launched"
                              ? "border-emerald-800/50 text-emerald-400"
                              : p.status === "building"
                              ? "border-amber-800/50 text-amber-400"
                              : "border-zinc-700 text-zinc-400",
                          )}
                        >
                          {p.status}
                        </Badge>
                      </div>
                    </div>
                    {p.progress > 0 ? (
                      <>
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-amber-500/70"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-zinc-600">
                          {p.progress}%
                        </p>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Agents" icon={Bot} iconClass="text-violet-300">
          {state.agents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center">
              <p className="text-sm text-zinc-600">No agents configured yet.</p>
              <Link href="/agents" className="mt-2 block text-xs text-amber-500 hover:text-amber-400">
                Set up agents →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {state.agents.slice(0, 6).map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-4 py-3"
                >
                  <div
                    className={cn(
                      "size-2 rounded-full shrink-0",
                      agent.status === "running" && "bg-zinc-500",
                      agent.status === "idle" && "bg-zinc-600",
                      agent.status === "error" && "bg-red-500",
                      agent.status === "paused" && "bg-amber-400",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-200 truncate">{agent.name}</p>
                    {agent.purpose && (
                      <p className="text-[11px] text-zinc-600 truncate">{agent.purpose}</p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] shrink-0",
                      agent.status === "running"
                        ? "border-emerald-800/50 text-emerald-400"
                        : agent.status === "error"
                        ? "border-red-800/50 text-red-400"
                        : "border-zinc-700 text-zinc-500",
                    )}
                  >
                    {agent.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Integrations" icon={Activity} iconClass="text-emerald-400">
          <DashboardIntegrationHealth />
        </Panel>
      </div>
    </div>
  );
}
