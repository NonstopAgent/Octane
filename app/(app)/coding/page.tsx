"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Code2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { CodingJobCard } from "@/components/modules/coding/coding-job-card";
import { EmptyState } from "@/components/modules";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  getGithubRepoForProject,
  getLinkedGithubRepos,
} from "@/lib/coding/github-repo-context";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { CodingJobMode, CodingJobPlan } from "@/lib/types/coding-job";

export default function CodingPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading coding…</p>}>
      <CodingPageContent />
    </Suspense>
  );
}

function CodingPageContent() {
  const searchParams = useSearchParams();
  const projects = useOctaneStore((s) => s.projects);
  const projectConnections = useOctaneStore((s) => s.projectConnections);
  const codingJobs = useOctaneStore((s) => s.codingJobs);
  const createCodingJob = useOctaneStore((s) => s.createCodingJob);
  const updateCodingJob = useOctaneStore((s) => s.updateCodingJob);
  const approveCodingJob = useOctaneStore((s) => s.approveCodingJob);
  const cancelCodingJob = useOctaneStore((s) => s.cancelCodingJob);
  const appendCodingJobLog = useOctaneStore((s) => s.appendCodingJobLog);

  const [projectId, setProjectId] = useState("");
  const [repo, setRepo] = useState("");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<CodingJobMode>("review");
  const [creating, setCreating] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const githubRepos = useMemo(
    () => getLinkedGithubRepos(projectConnections),
    [projectConnections],
  );

  const singleLinkedRepo = githubRepos.length === 1 ? githubRepos[0] : undefined;

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const sortedJobs = useMemo(
    () =>
      [...codingJobs].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [codingJobs],
  );

  useEffect(() => {
    const paramProject = searchParams.get("project") ?? "";
    const paramRepo = searchParams.get("repo") ?? "";
    const paramDetail = searchParams.get("detail");
    const paramPrompt = searchParams.get("prompt") ?? "";

    if (paramProject) {
      setProjectId(paramProject);
      const linked = getGithubRepoForProject(projectConnections, paramProject);
      if (linked) setRepo(linked);
    }
    if (paramRepo) setRepo(paramRepo);
    if (!paramRepo && !paramProject && singleLinkedRepo) {
      setRepo(singleLinkedRepo);
    }
    if (paramPrompt) setPrompt(paramPrompt);
    if (paramDetail) setHighlightId(paramDetail);
  }, [searchParams, projectConnections, singleLinkedRepo]);

  const hasRepo = Boolean(repo.trim());
  const repoReady = /^[\w.-]+\/[\w.-]+$/.test(repo.trim());

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const repoValue = repo.trim();
    const promptValue = prompt.trim();
    if (!repoValue || !promptValue) {
      toast.error("Repo and prompt are required");
      return;
    }
    if (!repoReady) {
      toast.error("Use owner/repo format");
      return;
    }

    setCreating(true);
    try {
      const project = projects.find((p) => p.id === projectId);
      const res = await fetch("/api/coding/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptValue,
          repo: repoValue,
          mode,
          projectId: projectId || undefined,
          projectName: project?.name,
        }),
      });
      const data = (await res.json()) as {
        title?: string;
        plan?: CodingJobPlan;
        error?: string;
        planSource?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create job");
      }

      const job = createCodingJob({
        title: data.title ?? promptValue.slice(0, 80),
        prompt: promptValue,
        repo: repoValue,
        mode,
        status: "pending_approval",
        projectId: projectId || undefined,
        plan: data.plan,
      });
      appendCodingJobLog(job.id, {
        level: "info",
        message: `Plan generated (${data.planSource ?? "server"})`,
        phase: "plan",
      });
      setHighlightId(job.id);
      toast.success("Coding job created — approve before run");
      setPrompt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Coding"
        description="Plan → approve → generate source edits → approve edits → source PR. Or use planning PR (docs only). Never auto-merge or deploy."
      />

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4"
      >
        <h2 className="text-sm font-medium text-zinc-300">New coding job</h2>
        <p className="text-xs text-zinc-500">
          After approving a plan, generate edits (review before PR), or open a planning PR (docs
          only). Source PRs require approved edits. Octane never merges or deploys.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="coding-project">Project (optional)</Label>
            <Select
              id="coding-project"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                const linked = getGithubRepoForProject(
                  projectConnections,
                  e.target.value,
                );
                if (linked) setRepo(linked);
              }}
              className="border-zinc-700 bg-zinc-900"
            >
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <CodingFormRepo
            repo={repo}
            setRepo={setRepo}
            githubRepos={githubRepos}
            hasRepo={hasRepo}
            repoReady={repoReady}
          />
          <CodingFormMode mode={mode} setMode={setMode} />
          <CodingFormPrompt prompt={prompt} setPrompt={setPrompt} />
        </div>
        <Button type="submit" disabled={creating || !repoReady} className="gap-2">
          {creating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Code2 className="size-4" />
          )}
          Create coding job
        </Button>
      </form>

      {sortedJobs.length === 0 ? (
        <EmptyState
          icon={Code2}
          title="No coding jobs yet"
          description='Try Ask Octane: "improve the Vercel connection flow in owner/repo" — or create a job above after linking a repo.'
        />
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">
            Jobs ({sortedJobs.length})
          </h2>
          <div className="space-y-3">
            {sortedJobs.map((job) => (
              <div
                key={job.id}
                id={`coding-job-${job.id}`}
                className={
                  highlightId === job.id
                    ? "rounded-xl ring-2 ring-amber-600/50 ring-offset-2 ring-offset-zinc-950"
                    : undefined
                }
              >
                <CodingJobCard
                  job={job}
                  projectName={
                    job.projectId ? projectNameById.get(job.projectId) : undefined
                  }
                  onApprove={approveCodingJob}
                  onCancel={cancelCodingJob}
                  onUpdate={updateCodingJob}
                  onAppendLog={appendCodingJobLog}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CodingFormRepo({
  repo,
  setRepo,
  githubRepos,
  hasRepo,
  repoReady,
}: {
  repo: string;
  setRepo: (v: string) => void;
  githubRepos: string[];
  hasRepo: boolean;
  repoReady: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="coding-repo">GitHub repo</Label>
      <Input
        id="coding-repo"
        value={repo}
        onChange={(e) => setRepo(e.target.value)}
        placeholder="owner/repo"
        list="coding-repo-suggestions"
        className="border-zinc-700 bg-zinc-900 font-mono text-sm"
        required
      />
      <datalist id="coding-repo-suggestions">
        {githubRepos.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      {!hasRepo ? (
        <p className="text-xs text-amber-300/80">
          Connect a GitHub repo first —{" "}
          <Link href="/connections" className="underline hover:text-amber-200">
            open Connections
          </Link>
          .
        </p>
      ) : !repoReady ? (
        <p className="text-xs text-zinc-500">Use owner/repo format (e.g. acme/app).</p>
      ) : null}
    </div>
  );
}

function CodingFormMode({
  mode,
  setMode,
}: {
  mode: CodingJobMode;
  setMode: (m: CodingJobMode) => void;
}) {
  return (
    <div className="grid gap-2 sm:col-span-2">
      <Label htmlFor="coding-mode">Mode</Label>
      <Select
        id="coding-mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as CodingJobMode)}
        className="border-zinc-700 bg-zinc-900"
      >
        <option value="review">Review — branch + PR, you merge on GitHub</option>
        <option value="assisted">Assisted — plan + PR with approval gate</option>
        <option value="autopilot" disabled>
          Autopilot (disabled)
        </option>
      </Select>
      <p className="text-[11px] text-zinc-600">
        Status in review mode: branch → planning PR → your review. Never merge or deploy from
        Octane.
      </p>
    </div>
  );
}

function CodingFormPrompt({
  prompt,
  setPrompt,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:col-span-2">
      <Label htmlFor="coding-prompt">What should Octane plan?</Label>
      <textarea
        id="coding-prompt"
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        placeholder='e.g. "Improve the Vercel deployment card on the dashboard and add a link from Outlook Ask Octane"'
        required
      />
    </div>
  );
}
