"use client";

import Link from "next/link";
import { Code2, Sparkles } from "lucide-react";

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
  const codingJobs = useOctaneStore((s) =>
    s.codingJobs.filter((j) => j.projectId === projectId),
  );
  const proposeOctaneAction = useOctaneStore((s) => s.proposeOctaneAction);

  const open = codingJobs.filter((j) =>
    ["pending_approval", "approved", "running", "pr_open"].includes(j.status),
  );
  const latest = [...codingJobs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];

  function askOctane() {
    proposeOctaneAction({
      type: "create_coding_job",
      title: githubRepo
        ? `Coding job for ${githubRepo}`
        : "Create coding job",
      description: "Proposes a GitHub coding workbench job (review mode).",
      payload: {
        prompt: githubRepo
          ? `Work on ${githubRepo}: `
          : "Describe the change for this project repo",
        repo: githubRepo,
        projectId,
      },
      source: "manual",
      projectId,
    });
  }

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
          Link a GitHub repo in Connections to enable coding jobs for this project.
        </p>
      ) : (
        <p className="font-mono text-xs text-zinc-500">{githubRepo}</p>
      )}
      {latest ? (
        <p className="text-sm text-zinc-400">
          Last job:{" "}
          <Badge variant="outline" className="border-zinc-700 text-xs capitalize">
            {latest.status.replace(/_/g, " ")}
          </Badge>
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
                PR #{latest.prNumber}
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1 border-zinc-700"
          onClick={askOctane}
          disabled={!githubRepo}
        >
          <Sparkles className="size-3.5" />
          Ask Octane to work on this repo
        </Button>
        <Link
          href={`/coding?project=${projectId}`}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-sm text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          <Code2 className="size-3.5" />
          Open Coding
        </Link>
      </div>
    </section>
  );
}
