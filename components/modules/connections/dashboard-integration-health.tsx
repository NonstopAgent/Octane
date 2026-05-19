"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cloud, GitBranch, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntegrationAuthStatus } from "@/lib/integrations/types";
import type { VercelDeploymentSummary } from "@/lib/integrations/types";
import { cn } from "@/lib/utils";

export function DashboardIntegrationHealth() {
  const [github, setGithub] = useState<IntegrationAuthStatus | null>(null);
  const [vercel, setVercel] = useState<IntegrationAuthStatus | null>(null);
  const [failedDeployments, setFailedDeployments] = useState<
    { project: string; deployment: VercelDeploymentSummary }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [ghRes, vcRes] = await Promise.all([
          fetch("/api/integrations/github/status"),
          fetch("/api/integrations/vercel/status"),
        ]);
        let vercelStatus: IntegrationAuthStatus | null = null;
        if (ghRes.ok) setGithub((await ghRes.json()) as IntegrationAuthStatus);
        if (vcRes.ok) {
          vercelStatus = (await vcRes.json()) as IntegrationAuthStatus;
          setVercel(vercelStatus);
        }

        if (vercelStatus?.connected) {
          const projectsRes = await fetch("/api/integrations/vercel/projects?limit=5");
          if (projectsRes.ok) {
            const { projects } = (await projectsRes.json()) as {
              projects: { id: string; name: string }[];
            };
            const failures: typeof failedDeployments = [];
            for (const p of projects.slice(0, 3)) {
              const depRes = await fetch(
                `/api/integrations/vercel/project?name=${encodeURIComponent(p.name)}`,
              );
              if (!depRes.ok) continue;
              const body = (await depRes.json()) as {
                project: { latestDeployment?: VercelDeploymentSummary | null };
              };
              const dep = body.project.latestDeployment;
              if (dep && (dep.state === "ERROR" || dep.readyState === "ERROR")) {
                failures.push({ project: p.name, deployment: dep });
              }
            }
            setFailedDeployments(failures);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Loader2 className="size-3.5 animate-spin" />
        Checking integrations…
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <HealthCard
        icon={GitBranch}
        title="GitHub"
        status={github}
        href="/connections"
      />
      <HealthCard
        icon={Cloud}
        title="Vercel"
        status={vercel}
        href="/connections"
      />
      {failedDeployments.length > 0 ? (
        <Card className="border-red-900/40 bg-red-950/10 sm:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-300">
              Recent deployment failures
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {failedDeployments.map((f) => (
              <p key={f.deployment.id} className="text-zinc-400">
                <span className="text-zinc-200">{f.project}</span> · {f.deployment.state}{" "}
                · {new Date(f.deployment.createdAt).toLocaleString()}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function HealthCard({
  icon: Icon,
  title,
  status,
  href,
}: {
  icon: typeof GitBranch;
  title: string;
  status: IntegrationAuthStatus | null;
  href: string;
}) {
  const ok = status?.connected;
  const configured = status?.configured;

  return (
    <Link href={href}>
      <Card
        className={cn(
          "border-zinc-800/80 bg-zinc-900/30 transition-colors hover:border-amber-800/40",
          ok && "border-emerald-900/30",
        )}
      >
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Icon className="size-4 text-zinc-400" />
          <CardTitle className="text-sm text-zinc-200">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "text-xs",
              ok
                ? "text-emerald-400"
                : configured
                  ? "text-amber-400"
                  : "text-zinc-500",
            )}
          >
            {!configured
              ? "Token not configured"
              : ok
                ? `Connected${status?.login ? ` · ${status.login}` : ""}`
                : "Needs attention"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
