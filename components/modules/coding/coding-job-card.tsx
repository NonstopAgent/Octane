"use client";

import { useState } from "react";
import {
  Check,
  ExternalLink,
  GitPullRequest,
  Loader2,
  Play,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CodingJob } from "@/lib/types/coding-job";
import { cn } from "@/lib/utils";

type CodingJobCardProps = {
  job: CodingJob;
  projectName?: string;
  onApprove: (id: string) => void;
  onCancel: (id: string) => void;
  onUpdate: (id: string, data: Partial<CodingJob>) => void;
  onAppendLog: (
    id: string,
    log: {
      level: "info" | "warn" | "error" | "success";
      message: string;
      phase?: string;
    },
  ) => void;
};

const STATUS_BORDER: Record<string, string> = {
  pending_approval: "border-amber-800/40",
  approved: "border-emerald-800/40",
  running: "border-sky-800/40",
  pr_open: "border-violet-800/40",
  completed: "border-emerald-800/40",
  failed: "border-red-800/40",
  cancelled: "border-zinc-700",
};

export function CodingJobCard({
  job,
  projectName,
  onApprove,
  onCancel,
  onUpdate,
  onAppendLog,
}: CodingJobCardProps) {
  const [running, setRunning] = useState(false);

  async function handleApprove() {
    try {
      const res = await fetch(`/api/coding/jobs/${job.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: job.status }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Approve failed");
      }
      onApprove(job.id);
      toast.success("Coding job approved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    }
  }

  async function handleRun() {
    if (job.status !== "approved") {
      toast.error("Approve the job before running");
      return;
    }
    setRunning(true);
    onUpdate(job.id, { status: "running" });
    onAppendLog(job.id, {
      level: "info",
      message: "Calling GitHub run API…",
      phase: "run",
    });

    try {
      const res = await fetch(`/api/coding/jobs/${job.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: { ...job, status: "approved" } }),
      });
      const data = (await res.json()) as Partial<CodingJob> & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Run failed");
      }
      onUpdate(job.id, {
        status: data.status ?? "pr_open",
        logs: data.logs ?? job.logs,
        changedFiles: data.changedFiles ?? job.changedFiles,
        branchName: data.branchName,
        baseBranch: data.baseBranch,
        prNumber: data.prNumber,
        prUrl: data.prUrl,
        errorMessage: data.errorMessage,
      });
      if (data.prUrl) {
        toast.success("Pull request opened");
      } else if (data.status === "failed") {
        toast.error(data.errorMessage ?? "Run failed");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Run failed";
      onUpdate(job.id, { status: "failed", errorMessage: msg });
      onAppendLog(job.id, { level: "error", message: msg, phase: "run" });
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  const canApprove = job.status === "pending_approval";
  const canRun = job.status === "approved";
  const canCancel = !["completed", "cancelled", "failed"].includes(job.status);

  return (
    <article
      className={cn(
        "rounded-xl border bg-zinc-900/40 px-4 py-4",
        STATUS_BORDER[job.status] ?? "border-zinc-800/80",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-100">{job.title}</p>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">{job.repo}</p>
          {projectName ? (
            <p className="mt-0.5 text-xs text-zinc-600">Project: {projectName}</p>
          ) : null}
          <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{job.prompt}</p>
        </div>
        <JobStatusBadges job={job} />
      </div>

      {job.plan ? (
        <section className="mt-4 space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Plan
          </h4>
          <p className="text-sm text-zinc-300">{job.plan.summary}</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-400">
            {job.plan.steps.map((step) => (
              <li key={step.id}>
                {step.title}
                {step.description ? (
                  <span className="text-zinc-600"> — {step.description}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {job.logs.length > 0 ? (
        <section className="mt-4 space-y-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Timeline
          </h4>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs font-mono text-zinc-500">
            {job.logs.map((entry) => (
              <li key={entry.id} className="flex gap-2">
                <span className="shrink-0 text-zinc-600">
                  {formatDistanceToNow(new Date(entry.timestamp), {
                    addSuffix: true,
                  })}
                </span>
                <span
                  className={cn(
                    entry.level === "error" && "text-red-400",
                    entry.level === "success" && "text-emerald-400",
                    entry.level === "warn" && "text-amber-400",
                  )}
                >
                  {entry.message}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {job.changedFiles.length > 0 ? (
        <section className="mt-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Changed files
          </h4>
          <ul className="mt-1 text-xs font-mono text-zinc-400">
            {job.changedFiles.map((f) => (
              <li key={f.path}>
                {f.action} {f.path}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {job.prUrl ? (
        <a
          href={job.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-violet-400 hover:underline"
        >
          <GitPullRequest className="size-3.5" />
          PR #{job.prNumber}
          <ExternalLink className="size-3" />
        </a>
      ) : null}

      {job.errorMessage ? (
        <p className="mt-2 text-xs text-red-400/90">{job.errorMessage}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canApprove ? (
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-emerald-700 hover:bg-emerald-600"
            onClick={handleApprove}
          >
            <Check className="size-3.5" />
            Approve
          </Button>
        ) : null}
        {canRun ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 border-zinc-700"
            disabled={running}
            onClick={handleRun}
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Run (open PR)
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1 text-zinc-400"
            onClick={() => onCancel(job.id)}
          >
            <X className="size-3.5" />
            Cancel
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function JobStatusBadges({ job }: { job: CodingJob }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <Badge variant="outline" className="border-zinc-700 text-xs capitalize">
        {job.status.replace(/_/g, " ")}
      </Badge>
      <Badge variant="outline" className="border-zinc-700 text-xs text-zinc-500">
        {job.mode} mode
      </Badge>
    </div>
  );
}
