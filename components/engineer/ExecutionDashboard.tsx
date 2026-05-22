"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, Loader2, Terminal } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type {
  EngineerExecutionDashboardSummary,
  EngineerExecutionHistoryItem,
  EngineerExecutionStatus,
  ExecutionDashboardProps,
} from "@/lib/types/engineer-execution";
import { cn } from "@/lib/utils";

function buildSummary(
  executions: EngineerExecutionHistoryItem[],
): EngineerExecutionDashboardSummary {
  const counts = {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  for (const row of executions) {
    if (row.status in counts) {
      counts[row.status as keyof typeof counts] += 1;
    }
  }

  const lastRun =
    executions.find(
      (e) => e.status === "completed" || e.status === "failed",
    ) ?? null;

  return { counts, lastRun };
}

function statusTone(status: EngineerExecutionStatus): string {
  switch (status) {
    case "completed":
      return "text-emerald-400 border-emerald-900/60 bg-emerald-950/30";
    case "failed":
      return "text-rose-400 border-rose-900/60 bg-rose-950/30";
    case "processing":
      return "text-amber-300 border-amber-900/60 bg-amber-950/30";
    default:
      return "text-zinc-300 border-zinc-700 bg-zinc-900/50";
  }
}

function ExecutionRow({
  item,
  expanded,
  onToggle,
}: {
  item: EngineerExecutionHistoryItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasLogs = Boolean(item.logs?.trim());

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80">
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasLogs}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
          hasLogs && "hover:bg-zinc-900/60",
          !hasLogs && "cursor-default opacity-90",
        )}
      >
        <span className="mt-0.5 text-zinc-500">
          {hasLogs ? (
            expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )
          ) : (
            <span className="inline-block size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                statusTone(item.status),
              )}
            >
              {item.status}
            </span>
            <span className="font-mono text-xs text-zinc-400">
              {item.command_type}
            </span>
            {item.project_name ? (
              <span className="text-xs text-zinc-500">{item.project_name}</span>
            ) : null}
          </div>
          <p className="truncate text-sm text-zinc-100">
            {item.id.slice(0, 8)}… ·{" "}
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </p>
        </div>
      </button>

      {expanded && hasLogs ? (
        <div className="border-t border-zinc-800 bg-black/60 px-4 py-3">
          <pre className="max-h-64 overflow-auto font-mono text-[11px] leading-relaxed text-zinc-200 whitespace-pre-wrap">
            {item.logs}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

export function ExecutionDashboard({
  initialExecutions,
}: ExecutionDashboardProps) {
  const [executions, setExecutions] = useState<EngineerExecutionHistoryItem[]>(
    initialExecutions ?? [],
  );
  const [loading, setLoading] = useState(!initialExecutions);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/engineer/history");
      const data = (await res.json()) as
        | EngineerExecutionHistoryItem[]
        | { error?: string };
      if (!res.ok) {
        const message =
          "error" in data && data.error
            ? data.error
            : `Failed to load history (${res.status})`;
        throw new Error(message);
      }
      setExecutions(data as EngineerExecutionHistoryItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialExecutions) {
      void loadHistory();
    }
  }, [initialExecutions, loadHistory]);

  const summary = useMemo(() => buildSummary(executions), [executions]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["queued", summary.counts.queued],
            ["processing", summary.counts.processing],
            ["completed", summary.counts.completed],
            ["failed", summary.counts.failed],
          ] as const
        ).map(([label, count]) => (
          <Card
            key={label}
            className="border-zinc-800 bg-zinc-950/90 shadow-none ring-1 ring-inset ring-zinc-800/80"
          >
            <CardContent className="p-4">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                {label}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
                {count}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="overflow-hidden border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900/40 shadow-none ring-1 ring-inset ring-zinc-700/40">
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-gradient-to-r from-zinc-600/80 to-transparent" />
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-zinc-400">
              Last completed run
            </p>
            <span className="h-px flex-1 bg-gradient-to-l from-zinc-600/80 to-transparent" />
          </div>
          {summary.lastRun ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-100">
              <span
                className={cn(
                  "rounded border px-2 py-0.5 text-[10px] font-medium uppercase",
                  statusTone(summary.lastRun.status),
                )}
              >
                {summary.lastRun.status}
              </span>
              <span className="font-mono text-zinc-400">
                {summary.lastRun.command_type}
              </span>
              <span className="text-zinc-500">
                {formatDistanceToNow(new Date(summary.lastRun.created_at), {
                  addSuffix: true,
                })}
              </span>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No completed runs in recent history.</p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-zinc-400" />
            <h2 className="text-sm font-medium text-zinc-200">Execution feed</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={loading}
            className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" />
            Loading executions…
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-rose-900/50 bg-rose-950/20 px-4 py-3 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        {!loading && !error && executions.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No executions yet. Trigger a cron typecheck or run an internal task.
          </p>
        ) : null}

        <div className="space-y-2">
          {executions.map((item) => (
            <ExecutionRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === item.id ? null : item.id))
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
