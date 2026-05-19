"use client";

import { useEffect, useState } from "react";
import { ExternalLink, GitMerge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectConnection } from "@/lib/types/project-connection";

type GitHubStats = {
  fullName: string;
  openIssues: number;
  pullRequests: { number: number; title: string; url: string }[];
  latestCommit: {
    shortSha: string;
    message: string;
    author: string;
    date: string;
    url: string;
  } | null;
};

type VercelStats = {
  project: { name: string };
  project_latest?: never;
  latestDeployment?: {
    state: string;
    url: string | null;
    createdAt: string;
  } | null;
};

type ProjectIntegrationStatsProps = {
  connection: ProjectConnection;
  onAskConnect?: () => void;
};

export function ProjectIntegrationStats({
  connection,
  onAskConnect,
}: ProjectIntegrationStatsProps) {
  const [loading, setLoading] = useState(true);
  const [github, setGithub] = useState<GitHubStats | null>(null);
  const [vercel, setVercel] = useState<VercelStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        if (connection.kind === "github" && connection.repo) {
          const res = await fetch(
            `/api/integrations/github/repo?repo=${encodeURIComponent(connection.repo)}`,
          );
          if (!res.ok) throw new Error("github");
          const data = (await res.json()) as GitHubStats & {
            issues: unknown[];
            pullRequests: GitHubStats["pullRequests"];
          };
          if (!cancelled) {
            setGithub({
              fullName: data.fullName ?? connection.repo,
              openIssues: data.openIssues ?? 0,
              pullRequests: data.pullRequests ?? [],
              latestCommit: data.latestCommit ?? null,
            });
          }
        } else if (connection.kind === "vercel") {
          const name = connection.label.trim();
          const res = await fetch(
            `/api/integrations/vercel/project?name=${encodeURIComponent(name)}`,
          );
          if (!res.ok) throw new Error("vercel");
          const data = (await res.json()) as {
            project: { name: string; latestDeployment?: VercelStats["latestDeployment"] };
          };
          if (!cancelled) {
            setVercel({
              project: data.project,
              latestDeployment: data.project.latestDeployment ?? null,
            });
          }
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [connection]);

  if (connection.status !== "linked" && connection.kind !== "website") {
    return (
      <p className="text-xs text-zinc-500">
        {connection.label} · pending approval
      </p>
    );
  }

  if (loading) {
    return (
      <p className="flex items-center gap-1 text-xs text-zinc-500">
        <Loader2 className="size-3 animate-spin" />
        Loading live stats…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-amber-400/80">
        Could not load stats — check server tokens on Connections.
      </p>
    );
  }

  if (connection.kind === "github" && github) {
    return (
      <div className="space-y-1 text-xs text-zinc-400">
        <p>
          {github.openIssues} open issues · {github.pullRequests.length} open PRs
        </p>
        {github.latestCommit ? (
          <p className="truncate text-zinc-500">
            Latest · {github.latestCommit.shortSha}{" "}
            {github.latestCommit.message}
          </p>
        ) : null}
        {github.pullRequests[0] ? (
          <a
            href={github.pullRequests[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-amber-400/80 hover:underline"
          >
            <GitMerge className="size-3" />
            #{github.pullRequests[0].number} {github.pullRequests[0].title}
          </a>
        ) : null}
      </div>
    );
  }

  if (connection.kind === "vercel" && vercel) {
    const dep = vercel.latestDeployment;
    return (
      <div className="space-y-1 text-xs text-zinc-400">
        <p>
          Deployment ·{" "}
          <span
            className={
              dep?.state === "READY"
                ? "text-emerald-400"
                : dep?.state === "ERROR"
                  ? "text-red-400"
                  : "text-zinc-300"
            }
          >
            {dep?.state ?? "unknown"}
          </span>
        </p>
        {dep?.url ? (
          <a
            href={dep.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-amber-400/80 hover:underline"
          >
            <ExternalLink className="size-3" />
            {dep.url.replace(/^https?:\/\//, "")}
          </a>
        ) : null}
      </div>
    );
  }

  if (connection.url) {
    return (
      <a
        href={connection.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-amber-400/80 hover:underline"
      >
        {connection.url}
      </a>
    );
  }

  return onAskConnect ? (
    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAskConnect}>
      Ask Octane to connect
    </Button>
  ) : null;
}
