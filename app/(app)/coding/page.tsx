"use client";

import { useMemo, useState } from "react";
import { Code2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { CodingJobCard } from "@/components/modules/coding/coding-job-card";
import { EmptyState } from "@/components/modules";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { CodingJobMode, CodingJobPlan } from "@/lib/types/coding-job";

export default function CodingPage() {
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

  const githubRepos = useMemo(() => {
    const fromLinks = projectConnections
      .filter((pc) => pc.kind === "github" && pc.repo)
      .map((pc) => pc.repo as string);
    return [...new Set(fromLinks)];
  }, [projectConnections]);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const repoValue = repo.trim();
    const promptValue = prompt.trim();
    if (!repoValue || !promptValue) {
      toast.error("Repo and prompt are required");
      return;
    }
    if (!/^[\w.-]+\/[\w.-]+$/.test(repoValue)) {
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
        description="Codex-style GitHub workbench: plan → approve → branch → PR. Review mode by default. Never auto-merges."
      />

      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4"
      >
        <h2 className="text-sm font-medium text-zinc-300">New coding job</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="coding-project">Project (optional)</Label>
            <Select
              id="coding-project"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                const link = projectConnections.find(
                  (pc) =>
                    pc.projectId === e.target.value &&
                    pc.kind === "github" &&
                    pc.repo,
                );
                if (link?.repo) setRepo(link.repo);
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
          <CodingFormRepo repo={repo} setRepo={setRepo} githubRepos={githubRepos} />
          <CodingFormMode mode={mode} setMode={setMode} />
          <CodingFormPrompt prompt={prompt} setPrompt={setPrompt} />
        </div>
        <Button type="submit" disabled={creating} className="gap-2">
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
          description='Try "fix the auth flow in owner/repo" in Ask Octane, or create a job above.'
        />
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-400">
            Jobs ({sortedJobs.length})
          </h2>
          <div className="space-y-3">
            {sortedJobs.map((job) => (
              <CodingJobCard
                key={job.id}
                job={job}
                projectName={
                  job.projectId ? projectNameById.get(job.projectId) : undefined
                }
                onApprove={approveCodingJob}
                onCancel={cancelCodingJob}
                onUpdate={updateCodingJob}
                onAppendLog={appendCodingJobLog}
              />
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
}: {
  repo: string;
  setRepo: (v: string) => void;
  githubRepos: string[];
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
        <option value="review">Review (default)</option>
        <option value="assisted">Assisted</option>
        <option value="autopilot" disabled>
          Autopilot (disabled — docs-only low-risk placeholder)
        </option>
      </Select>
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
      <Label htmlFor="coding-prompt">Prompt</Label>
      <textarea
        id="coding-prompt"
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        placeholder="Describe the change you want as a PR…"
        required
      />
    </div>
  );
}
