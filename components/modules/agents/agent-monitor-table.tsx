"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, GitBranch } from "lucide-react";
import Link from "next/link";

import { AgentStatusBadge } from "@/components/modules/agents/agent-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { PROJECT_IDS } from "@/lib/mock/seed";
import { cn } from "@/lib/utils";

export type AgentMonitorStatus = "active" | "idle" | "error" | "loading";

export type AgentMonitorRow = {
  id: string;
  name: string;
  purpose: string;
  repo: string;
  projectId: string;
  pipelineNote: string;
};

export const AGENT_MONITOR_ROWS: AgentMonitorRow[] = [
  {
    id: "monitor-ajax-operator",
    name: "Octane Ajax Operator",
    purpose:
      "Monitors Nova → Forge → Pixel pipeline activity on the Ajax repo (read-only).",
    repo: "NonstopAgent/Octane-Ajax",
    projectId: PROJECT_IDS.ajax,
    pipelineNote: "Nova / Forge / Pixel",
  },
  {
    id: "monitor-nexus-agent",
    name: "Octane Nexus Agent",
    purpose:
      "Tracks ingestion and media signal work on the Nexus repo (read-only).",
    repo: "NonstopAgent/Octane-Nexus",
    projectId: PROJECT_IDS.nexus,
    pipelineNote: "Ingestion & media signals",
  },
];

type RepoSummary = {
  fullName: string;
  pushedAt: string | null;
  openIssues?: number;
  url?: string;
  latestCommit?: { date: string; message: string; shortSha: string } | null;
  error?: string;
};

function deriveMonitorStatus(
  summary: RepoSummary | null,
  fetchFailed: boolean,
): AgentMonitorStatus {
  if (fetchFailed) return "error";
  if (!summary) return "loading";
  const touched =
    summary.pushedAt ?? summary.latestCommit?.date ?? null;
  if (!touched) return "idle";
  const hours =
    (Date.now() - new Date(touched).getTime()) / (1000 * 60 * 60);
  if (hours <= 48) return "active";
  return "idle";
}

function useRepoMonitor(repo: string) {
  const [summary, setSummary] = useState<RepoSummary | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchFailed(false);

    fetch(`/api/integrations/github/repo?repo=${encodeURIComponent(repo)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) {
            setFetchFailed(true);
            setSummary({ fullName: repo, pushedAt: null, error: body.error });
          }
          return;
        }
        const data = (await res.json()) as RepoSummary;
        if (!cancelled) setSummary(data);
      })
      .catch(() => {
        if (!cancelled) setFetchFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repo]);

  const status: AgentMonitorStatus = loading
    ? "loading"
    : deriveMonitorStatus(summary, fetchFailed);

  const lastActivity = summary?.pushedAt ?? summary?.latestCommit?.date ?? null;
  const lastActivityLabel = lastActivity
    ? formatDistanceToNow(new Date(lastActivity), { addSuffix: true })
    : null;

  return { summary, status, lastActivityLabel, fetchFailed };
}

function MonitorStatusBadge({ status }: { status: AgentMonitorStatus }) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[11px] text-zinc-400">
        Checking…
      </span>
    );
  }
  const mapped =
    status === "active"
      ? "running"
      : status === "error"
        ? "error"
        : "idle";
  return <AgentStatusBadge status={mapped} />;
}

export function AgentMonitorTable() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {AGENT_MONITOR_ROWS.map((row) => (
        <AgentMonitorCard key={row.id} row={row} />
      ))}
    </div>
  );
}

function AgentMonitorCard({ row }: { row: AgentMonitorRow }) {
  const { summary, status, lastActivityLabel, fetchFailed } = useRepoMonitor(
    row.repo,
  );

  return (
    <Card className="border-zinc-800/80 bg-zinc-900/40">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-zinc-100">{row.name}</p>
            <p className="mt-1 text-xs text-zinc-500">{row.purpose}</p>
          </div>
          <MonitorStatusBadge status={status} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          <GitBranch className="size-3.5 shrink-0" aria-hidden />
          <span className="font-mono">{row.repo}</span>
          <span className="text-zinc-700">·</span>
          <span>{row.pipelineNote}</span>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-zinc-600">Last GitHub activity</dt>
            <dd className="mt-0.5 text-zinc-300">
              {lastActivityLabel ?? (fetchFailed ? "Unavailable" : "—")}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-600">Open issues</dt>
            <dd className="mt-0.5 text-zinc-300 tabular-nums">
              {summary?.openIssues ?? "—"}
            </dd>
          </div>
        </dl>

        {summary?.latestCommit ? (
          <p className="truncate text-xs text-zinc-500">
            Latest:{" "}
            <span className="text-zinc-400">{summary.latestCommit.message}</span>
            {summary.latestCommit.shortSha
              ? ` (${summary.latestCommit.shortSha})`
              : null}
          </p>
        ) : null}

        {fetchFailed ? (
          <p className="text-xs text-amber-200/90">
            GitHub status unavailable — connect token in Settings for live
            workflow and commit signals.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={`/projects?detail=${row.projectId}`}
            className={cn(
              "inline-flex h-8 items-center rounded-lg border border-zinc-700 px-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800",
            )}
          >
            Portfolio project
          </Link>
          <a
            href={`https://github.com/${row.repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-700 px-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
          >
            <ExternalLink className="size-3" aria-hidden />
            GitHub
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
