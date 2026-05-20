"use client";

import { useState } from "react";
import {
  Check,
  ExternalLink,
  GitPullRequest,
  Loader2,
  Play,
  RefreshCw,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CodingJob, CodingJobPlan } from "@/lib/types/coding-job";
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
  const [generating, setGenerating] = useState(false);

  const editsPending = job.editApprovalStatus === "pending";
  const editsApproved = job.editApprovalStatus === "approved";
  const hasProposedEdits = (job.proposedEdits?.length ?? 0) > 0;

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

  async function handleRunPlanningPr() {
    if (job.status !== "approved") {
      toast.error("Approve the job before running");
      return;
    }
    setRunning(true);
    onUpdate(job.id, { status: "running" });
    onAppendLog(job.id, {
      level: "info",
      message: "Calling GitHub planning PR API…",
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
        prKind: "planning",
        editMode: "planning_pr",
        errorMessage: data.errorMessage,
      });
      if (data.prUrl) {
        toast.success("Planning pull request opened");
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

  async function handleGenerateEdits() {
    if (job.status !== "approved") {
      toast.error("Approve the plan before generating edits");
      return;
    }
    setGenerating(true);
    onAppendLog(job.id, {
      level: "info",
      message: "Generating source edit proposal…",
      phase: "edits",
    });
    try {
      const res = await fetch(`/api/coding/jobs/${job.id}/generate-edits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const data = (await res.json()) as Partial<CodingJob> & {
        error?: string;
        activityMessage?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Generate edits failed");
      }
      onUpdate(job.id, {
        editMode: "source_pr",
        proposedFiles: data.proposedFiles,
        proposedEdits: data.proposedEdits,
        editApprovalStatus: "pending",
      });
      onAppendLog(job.id, {
        level: "success",
        message: data.activityMessage ?? "Generated source edit proposal",
        phase: "edits",
      });
      if (data.message) {
        onAppendLog(job.id, { level: "info", message: data.message, phase: "edits" });
      }
      toast.success("Source edits proposed — review and approve");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generate failed";
      onAppendLog(job.id, { level: "error", message: msg, phase: "edits" });
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  function handleApproveEdits() {
    onUpdate(job.id, { editApprovalStatus: "approved" });
    onAppendLog(job.id, {
      level: "success",
      message: "Source edits approved",
      phase: "edits",
    });
    toast.success("Edits approved — you can run source PR");
  }

  function handleRejectEdits() {
    onUpdate(job.id, {
      editApprovalStatus: "rejected",
      proposedEdits: undefined,
      proposedFiles: undefined,
    });
    onAppendLog(job.id, {
      level: "warn",
      message: "Source edits rejected",
      phase: "edits",
    });
    toast.message("Edits rejected — regenerate or use planning PR only");
  }

  async function handleRunSourcePr() {
    if (job.editApprovalStatus !== "approved") {
      toast.error("Approve proposed edits first");
      return;
    }
    setRunning(true);
    onUpdate(job.id, { status: "running" });
    onAppendLog(job.id, {
      level: "info",
      message: "Opening source PR on GitHub…",
      phase: "source-pr",
    });
    try {
      const res = await fetch(`/api/coding/jobs/${job.id}/run-source-pr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job: { ...job, editApprovalStatus: "approved", status: "approved" },
        }),
      });
      const data = (await res.json()) as Partial<CodingJob> & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Source PR failed");
      }
      onUpdate(job.id, {
        status: data.status ?? "pr_open",
        logs: data.logs ?? job.logs,
        changedFiles: data.changedFiles ?? job.changedFiles,
        branchName: data.branchName,
        baseBranch: data.baseBranch,
        prNumber: data.prNumber,
        prUrl: data.prUrl,
        prKind: "source",
        editMode: "source_pr",
        errorMessage: data.errorMessage,
      });
      if (data.prUrl) {
        toast.success("Source pull request opened");
      } else if (data.status === "failed") {
        toast.error(data.errorMessage ?? "Source PR failed");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Source PR failed";
      onUpdate(job.id, { status: "failed", errorMessage: msg });
      onAppendLog(job.id, { level: "error", message: msg, phase: "source-pr" });
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  const canApprove = job.status === "pending_approval";
  const canRunPlanning = job.status === "approved" && job.prKind !== "source";
  const canGenerateEdits =
    job.status === "approved" && (!hasProposedEdits || job.editApprovalStatus === "rejected");
  const canApproveEdits = hasProposedEdits && editsPending;
  const canRejectEdits = hasProposedEdits && editsPending;
  const canRegenerateEdits =
    job.status === "approved" && hasProposedEdits && !canGenerateEdits;
  const canRunSource =
    editsApproved && hasProposedEdits && job.prKind !== "source" && job.status !== "running";
  const canCancel = !["completed", "cancelled", "failed"].includes(job.status);

  return (
    <article
      className={cn(
        "rounded-xl border bg-zinc-900/40 px-4 py-4",
        STATUS_BORDER[job.status] ?? "border-zinc-800/80",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <JobHeaderText job={job} projectName={projectName} />
        <JobStatusBadges job={job} />
      </div>

      {job.plan ? <PlanSection plan={job.plan} /> : null}

      {hasProposedEdits ? (
        <ProposedEditsSection edits={job.proposedEdits!} approval={job.editApprovalStatus} />
      ) : null}

      {job.logs.length > 0 ? <TimelineSection logs={job.logs} /> : null}

      {job.changedFiles.length > 0 ? <ChangedFilesSection files={job.changedFiles} /> : null}

      {job.prUrl ? (
        <a
          href={job.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-violet-400 hover:underline"
        >
          <GitPullRequest className="size-3.5" />
          {job.prKind === "source" ? "Source" : "Planning"} PR #{job.prNumber}
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
            Approve plan
          </Button>
        ) : null}
        {canGenerateEdits ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 border-amber-800/50"
            disabled={generating}
            onClick={handleGenerateEdits}
          >
            {generating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Generate edits
          </Button>
        ) : null}
        {canApproveEdits ? (
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-emerald-700 hover:bg-emerald-600"
            onClick={handleApproveEdits}
          >
            <Check className="size-3.5" />
            Approve edits
          </Button>
        ) : null}
        {canRejectEdits ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1 text-zinc-400"
            onClick={handleRejectEdits}
          >
            <X className="size-3.5" />
            Reject edits
          </Button>
        ) : null}
        {canRegenerateEdits ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 border-zinc-700"
            disabled={generating}
            onClick={handleGenerateEdits}
          >
            {generating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Regenerate edits
          </Button>
        ) : null}
        {canRunSource ? (
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-violet-700 hover:bg-violet-600"
            disabled={running}
            onClick={handleRunSourcePr}
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Run source PR
          </Button>
        ) : null}
        {canRunPlanning ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 border-zinc-700"
            disabled={running}
            onClick={handleRunPlanningPr}
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Create planning PR
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

function JobHeaderText({ job, projectName }: { job: CodingJob; projectName?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium text-zinc-100">{job.title}</p>
      <p className="mt-0.5 font-mono text-xs text-zinc-500">{job.repo}</p>
      {projectName ? (
        <p className="mt-0.5 text-xs text-zinc-600">Project: {projectName}</p>
      ) : null}
      <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{job.prompt}</p>
    </div>
  );
}

function PlanSection({ plan }: { plan: CodingJobPlan }) {
  return (
    <section className="mt-4 space-y-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Plan</h4>
      {plan.understoodRequest ? (
        <p className="text-sm text-zinc-400">
          <span className="text-zinc-500">Understood: </span>
          {plan.understoodRequest}
        </p>
      ) : null}
      <p className="text-sm text-zinc-300">{plan.summary}</p>
      <PlanList title="Steps" items={plan.steps.map((s) => s.title)} />
      <PlanList title="Files likely" items={plan.files} />
      <PlanList title="Risks" items={plan.risks} />
      <PlanList title="Test / build" items={plan.testPlan} />
      <PlanList title="Review items" items={plan.reviewItems} />
      <PlanList title="Won't auto-happen" items={plan.wontAutoHappen} />
    </section>
  );
}

function ProposedEditsSection({
  edits,
  approval,
}: {
  edits: NonNullable<CodingJob["proposedEdits"]>;
  approval?: CodingJob["editApprovalStatus"];
}) {
  return (
    <section className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Proposed source edits ({edits.length})
        </h4>
        {approval ? (
          <Badge variant="outline" className="border-zinc-700 text-[10px] capitalize">
            edits {approval}
          </Badge>
        ) : null}
      </div>
      <ul className="space-y-3">
        {edits.map((edit) => (
          <li
            key={edit.path}
            className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3"
          >
            <p className="font-mono text-xs text-amber-400/90">{edit.path}</p>
            <p className="mt-1 text-xs text-zinc-400">{edit.summary}</p>
            <EditPreviews edit={edit} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EditPreviews({
  edit,
}: {
  edit: NonNullable<CodingJob["proposedEdits"]>[number];
}) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <PreviewBlock label="Before" text={edit.beforePreview} />
      <PreviewBlock label="After" text={edit.afterPreview} />
    </div>
  );
}

function PreviewBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase text-zinc-600">{label}</p>
      <pre className="mt-1 max-h-28 overflow-auto rounded border border-zinc-800/80 bg-zinc-950 p-2 text-[10px] text-zinc-500 whitespace-pre-wrap">
        {text || "—"}
      </pre>
    </div>
  );
}

function TimelineSection({ logs }: { logs: CodingJob["logs"] }) {
  return (
    <section className="mt-4 space-y-1">
      <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Timeline</h4>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-xs font-mono text-zinc-500">
        {logs.map((entry) => (
          <li key={entry.id} className="flex gap-2">
            <span className="shrink-0 text-zinc-600">
              {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
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
  );
}

function ChangedFilesSection({ files }: { files: CodingJob["changedFiles"] }) {
  return (
    <section className="mt-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Changed files
      </h4>
      <ul className="mt-1 text-xs font-mono text-zinc-400">
        {files.map((f) => (
          <li key={f.path}>
            {f.action} {f.path}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlanList({ title, items }: { title: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">{title}</p>
      <ul className="mt-1 list-inside list-disc text-xs text-zinc-500">
        {items.map((item) => (
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
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
      {job.prKind ? (
        <Badge variant="outline" className="border-violet-900/50 text-[10px] text-violet-400">
          {job.prKind} PR
        </Badge>
      ) : null}
      {job.editApprovalStatus && job.proposedEdits?.length ? (
        <Badge variant="outline" className="border-amber-900/50 text-[10px] text-amber-400">
          edits {job.editApprovalStatus}
        </Badge>
      ) : null}
    </div>
  );
}
