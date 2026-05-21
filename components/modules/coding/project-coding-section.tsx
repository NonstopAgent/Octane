"use client";

import Link from "next/link";
import { Code2, Sparkles } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOctaneStore } from "@/lib/store/octane-store";

type ProjectCodingSectionProps = {
  projectId: string;
  githubRepo?: string;
};

export function ProjectCodingSection({
  projectId,
  githubRepo,
}: ProjectCodingSectionProps) {
  const codingJobs = useOctaneStore(
    useShallow((s) =>
      s.codingJobs.filter((j) => j.projectId === projectId),
    ),
  );

  const open = codingJobs.filter((j) =>
    ["pending_approval", "approved", "running", "pr_open"].includes(j.status),
  );
  const latest = [...codingJobs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];

  const codingHref = githubRepo
    ? `/coding?project=${encodeURIComponent(projectId)}&repo=${encodeURIComponent(githubRepo)}`
    : `/coding?project=${encodeURIComponent(projectId)}`;

  return (
    <section className="space-y-3" data-section="project-coding">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Coding workbench
        </h3>
        <Link href="/coding" className="text-xs text-amber-500/80 hover:underline">
          All jobs
        </Link>
      </div>
      {!githubRepo ? (
        <p className="text-sm text-zinc-500">
          No GitHub repo linked.{" "}
          <Link href="/connections" className="text-amber-400/90 hover:underline">
            Connect a repo
          </Link>{" "}
          to enable coding jobs for this project.
        </p>
      ) : (
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            Linked GitHub repo
          </p>
          <p className="font-mono text-sm text-zinc-300">{githubRepo}</p>
        </div>
      )}
      {latest ? (
        <p className="text-sm text-zinc-400">
          Latest job:{" "}
          <Badge variant="outline" className="border-zinc-700 text-xs capitalize">
            {latest.status.replace(/_/g, " ")}
          </Badge>
          {latest.editApprovalStatus === "pending" && latest.proposedEdits?.length ? (
            <>
              {" "}
              ·{" "}
              <Link
                href={`/coding?detail=${latest.id}`}
                className="text-amber-400/90 hover:underline"
              >
                edits awaiting approval
              </Link>
            </>
          ) : null}
          {latest.prUrl ? (
            <>
              {" "}
              ·{" "}
              <a
                href={latest.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:underline"
              >
                {latest.prKind === "source" ? "Source" : "Planning"} PR #{latest.prNumber}
              </a>
            </>
          ) : null}
        </p>
      ) : (
        <p className="text-sm text-zinc-500">No coding jobs for this project yet.</p>
      )}
      {open.length > 0 ? (
        <p className="text-xs text-zinc-600">
          {open.length} open job{open.length === 1 ? "" : "s"}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {githubRepo ? (
          <Link
            href={codingHref}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-700 bg-transparent px-3 text-sm text-zinc-200 hover:bg-zinc-800/60"
          >
            <Sparkles className="size-3.5" />
            Ask Octane to work on repo
          </Link>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 border-zinc-700"
            disabled
          >
            <Sparkles className="size-3.5" />
            Ask Octane to work on repo
          </Button>
        )}
        {githubRepo && latest?.status === "approved" ? (
          <Link
            href={`/coding?detail=${latest.id}`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-900/40 px-3 text-sm text-amber-300/90 hover:bg-amber-950/40"
          >
            <Code2 className="size-3.5" />
            Source edits
          </Link>
        ) : null}
        <Link
          href={codingHref}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          <Code2 className="size-3.5" />
          Open Coding
        </Link>
      </div>
    </section>
  );
}
