"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckSquare,
  ChevronRight,
  Clock,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Sparkles,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useShallow } from "zustand/react/shallow";

import { DashboardCodingCards } from "@/components/modules/coding/dashboard-coding-cards";
import { DashboardIntegrationHealth } from "@/components/modules/connections/dashboard-integration-health";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";
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
    <Card className="border-zinc-800/80 bg-zinc-900/40">
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));

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

  const profileName = state.profile?.name ?? "Logan";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title={`${greeting}, ${profileName}`}
        description="Live status across Octane Ajax, Nexus, and your open work."
      />

      <Link
        href="/outlook#ask-octane"
        className="flex items-center justify-between gap-3 rounded-xl border border-amber-900/30 bg-amber-950/15 px-4 py-3 transition-colors hover:border-amber-800/50 hover:bg-amber-950/25"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Sparkles className="size-4 shrink-0 text-amber-400/90" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-100">Ask Octane</p>
            <p className="text-xs text-amber-300/55">
              Executive questions on risks, focus, and portfolio outlook
            </p>
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-amber-500/60" aria-hidden />
      </Link>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/actions"
          className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 hover:border-amber-800/40"
        >
          <p className="text-lg font-bold text-zinc-100">
            {state.octaneActions.filter((a) => a.status === "proposed").length}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Pending approvals</p>
        </Link>
        <Link
          href="/connections"
          className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 hover:border-amber-800/40"
        >
          <p className="text-lg font-bold text-zinc-100">
            {state.connections.filter((c) => c.status === "connected").length}
            <span className="text-sm font-normal text-zinc-500">
              /{state.connections.length}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Connected services</p>
        </Link>
        <Link
          href="/projects"
          className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 hover:border-amber-800/40"
        >
          <p className="text-lg font-bold text-zinc-100">
            {state.projects.filter(
              (p) =>
                !state.projectConnections.some((pc) => pc.projectId === p.id),
            ).length}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Projects missing links</p>
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={cn(
          "rounded-xl border px-4 py-3",
          criticalTasks.length > 0
            ? "border-red-900/50 bg-red-950/20"
            : "border-zinc-800/80 bg-zinc-900/30"
        )}>
          <p className={cn(
            "text-2xl font-bold",
            criticalTasks.length > 0 ? "text-red-400" : "text-zinc-100"
          )}>
            {criticalTasks.length}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Critical tasks</p>
        </div>
        <div className={cn(
          "rounded-xl border px-4 py-3",
          blockedTasks.length > 0
            ? "border-amber-900/50 bg-amber-950/20"
            : "border-zinc-800/80 bg-zinc-900/30"
        )}>
          <p className={cn(
            "text-2xl font-bold",
            blockedTasks.length > 0 ? "text-amber-400" : "text-zinc-100"
          )}>
            {blockedTasks.length}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Blocked tasks</p>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3">
          <p className="text-2xl font-bold text-zinc-100">{openTasks.length}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Open tasks</p>
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3">
          <p className="text-2xl font-bold text-zinc-100">{state.agents.length}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Demo agents (seed)</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
          <Activity className="size-3.5 text-emerald-400" />
          Integration health
        </h2>
        <DashboardIntegrationHealth />
      </div>

      <DashboardCodingCards />

      {/* Live repo status — the core of the dashboard */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-zinc-400 flex items-center gap-2">
          <Activity className="size-3.5 text-emerald-400" />
          Live Repo Status
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <RepoStatusCard
            repo="NonstopAgent/Octane-Ajax"
            label="Octane Ajax"
            emoji="🚀"
          />
          <RepoStatusCard
            repo="NonstopAgent/Octane-Nexus"
            label="Octane Nexus"
            emoji="🔭"
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
      <div className="grid gap-4 md:grid-cols-2">
        {/* Projects */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-zinc-400 flex items-center gap-2">
            <Zap className="size-3.5 text-amber-400" />
            Active Builds ({activeProjects.length})
          </h2>
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
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-amber-500/70"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-600">{p.progress}%</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Agents */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-zinc-400 flex items-center gap-2">
            <Bot className="size-3.5 text-purple-400" />
            Demo agents (portfolio seed)
          </h2>
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
        </div>
      </div>

    </div>
  );
}
