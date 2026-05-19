"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckSquare,
  ChevronRight,
  GitBranch,
  Globe,
  TrendingUp,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOctaneStore } from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";
import type { Entity } from "@/lib/types";

export default function UniversePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <UniversePageContent />
    </Suspense>
  );
}

function EntityStatusDot({ status }: { status: Entity["status"] }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full shrink-0",
        status === "active" && "bg-emerald-400",
        status === "forming" && "bg-amber-400 animate-pulse",
        status === "inactive" && "bg-zinc-600",
        status === "dissolved" && "bg-red-600",
      )}
    />
  );
}

function EntityTypeBadge({ type }: { type: Entity["type"] }) {
  const map: Record<Entity["type"], string> = {
    trust: "border-purple-800/60 text-purple-300",
    llc: "border-blue-800/60 text-blue-300",
    lab: "border-cyan-800/60 text-cyan-300",
    holding: "border-zinc-700 text-zinc-400",
    subsidiary: "border-zinc-700 text-zinc-400",
    product: "border-amber-800/60 text-amber-300",
    other: "border-zinc-700 text-zinc-400",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] capitalize", map[type])}
    >
      {type}
    </Badge>
  );
}

function EntityCard({
  entity,
  taskCount,
  agentCount,
  projectCount,
  runningAgentCount,
  errorCount,
}: {
  entity: Entity;
  taskCount: number;
  agentCount: number;
  projectCount: number;
  runningAgentCount: number;
  errorCount: number;
}) {
  const hasIntegrations = entity.githubRepo || entity.vercelProjectId || entity.websiteUrl;

  return (
    <Card
      className={cn(
        "border border-zinc-800/80 bg-zinc-900/30 transition-all hover:border-zinc-700/80 hover:bg-zinc-900/50",
        entity.status === "forming" && "border-amber-900/40",
      )}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {entity.logoEmoji && (
              <span className="text-2xl shrink-0">{entity.logoEmoji}</span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <EntityStatusDot status={entity.status} />
                <h3 className="font-semibold text-zinc-100 truncate">
                  {entity.name}
                </h3>
              </div>
              {entity.tagline && (
                <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                  {entity.tagline}
                </p>
              )}
            </div>
          </div>
          <EntityTypeBadge type={entity.type} />
        </div>

        {/* Metrics */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-zinc-950/50 px-2.5 py-2 text-center">
            <p className="text-lg font-bold text-zinc-100">{projectCount}</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Projects</p>
          </div>
          <div className="rounded-lg bg-zinc-950/50 px-2.5 py-2 text-center">
            <p className={cn("text-lg font-bold", taskCount > 0 ? "text-zinc-100" : "text-zinc-600")}>
              {taskCount}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Open tasks</p>
          </div>
          <div className="rounded-lg bg-zinc-950/50 px-2.5 py-2 text-center">
            <p
              className={cn(
                "text-lg font-bold",
                runningAgentCount > 0 ? "text-emerald-400" : agentCount > 0 ? "text-zinc-100" : "text-zinc-600",
              )}
            >
              {agentCount}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Agents</p>
          </div>
        </div>

        {/* Status flags */}
        {(errorCount > 0 || runningAgentCount > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {runningAgentCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 text-[10px] text-emerald-400">
                <Activity className="size-2.5" />
                {runningAgentCount} running
              </span>
            )}
            {errorCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-950/50 border border-red-800/40 px-2 py-0.5 text-[10px] text-red-400">
                <AlertCircle className="size-2.5" />
                {errorCount} error{errorCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Integrations */}
        {hasIntegrations && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800/60 pt-3">
            {entity.githubRepo && (
              <a
                href={`https://github.com/${entity.githubRepo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <GitBranch className="size-3" />
                {entity.githubRepo}
              </a>
            )}
            {entity.websiteUrl && (
              <a
                href={entity.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Globe className="size-3" />
                Live
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UniversePageContent() {
  const entities = useOctaneStore((s) => s.entities);
  const projects = useOctaneStore((s) => s.projects);
  const tasks = useOctaneStore((s) => s.tasks);
  const agents = useOctaneStore((s) => s.agents);

  // Cross-entity metrics
  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === "building" || p.status === "testing" || p.status === "launched").length;
    const openTasks = tasks.filter((t) => t.status !== "done").length;
    const criticalTasks = tasks.filter((t) => t.priority === "critical" && t.status !== "done").length;
    const runningAgents = agents.filter((a) => a.status === "running").length;
    const errorAgents = agents.filter((a) => a.status === "error").length;

    return { totalProjects, activeProjects, openTasks, criticalTasks, runningAgents, errorAgents };
  }, [projects, tasks, agents]);

  // Per-entity computed data
  const entityData = useMemo(() => {
    return entities.map((entity) => {
      const linkedIds = new Set(entity.linkedProjectIds ?? []);
      const entityProjects = projects.filter((p) => linkedIds.has(p.id));
      const entityProjectIds = new Set(entityProjects.map((p) => p.id));
      const entityTasks = tasks.filter(
        (t) => t.projectId && entityProjectIds.has(t.projectId) && t.status !== "done",
      );

      const entityAgents = agents.filter(
        (a) => a.assignedProjectId && entityProjectIds.has(a.assignedProjectId),
      );
      const runningAgentCount = entityAgents.filter((a) => a.status === "running").length;
      const errorCount = entityAgents.filter((a) => a.status === "error").length;

      return {
        entity,
        projectCount: entityProjects.length,
        taskCount: entityTasks.length,
        agentCount: entityAgents.length,
        runningAgentCount,
        errorCount,
      };
    });
  }, [entities, projects, tasks, agents]);

  // Conflict detection — tasks/projects that span multiple entities
  const sharedWork = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.assignedTo) return false;
      return t.assignedTo === "AI Agent" && t.status === "in_progress";
    }).slice(0, 6);
  }, [tasks]);

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="Octane Universe"
        description="Every entity, project, and agent across the entire Octane portfolio — one view."
      />

      {/* Portfolio summary bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Entities", value: entities.length, icon: Globe, color: "text-zinc-200" },
          { label: "Projects", value: stats.totalProjects, icon: TrendingUp, color: "text-blue-400" },
          { label: "Active builds", value: stats.activeProjects, icon: Zap, color: "text-amber-400" },
          { label: "Open tasks", value: stats.openTasks, icon: CheckSquare, color: "text-zinc-200" },
          { label: "Critical", value: stats.criticalTasks, icon: AlertCircle, color: stats.criticalTasks > 0 ? "text-red-400" : "text-zinc-500" },
          { label: "Running agents", value: stats.runningAgents, icon: Bot, color: stats.runningAgents > 0 ? "text-emerald-400" : "text-zinc-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 px-4 py-3 text-center"
          >
            <Icon className={cn("mx-auto mb-1 size-4", color)} />
            <p className={cn("text-xl font-bold", color)}>{value}</p>
            <p className="text-[10px] text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Entity grid */}
      <div>
        <h2 className="mb-4 text-sm font-medium text-zinc-400">Portfolio entities</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {entityData.map((d) => (
            <EntityCard key={d.entity.id} {...d} />
          ))}
        </div>
      </div>

      {/* Cross-entity AI agent work */}
      {sharedWork.length > 0 && (
        <div>
          <h2 className="mb-4 text-sm font-medium text-zinc-400">
            AI agents working across entities
          </h2>
          <div className="space-y-2">
            {sharedWork.map((task) => {
              const project = projects.find((p) => p.id === task.projectId);
              const entity = entities.find((e) =>
                e.linkedProjectIds?.includes(task.projectId ?? ""),
              );
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800/70 bg-zinc-900/30 px-4 py-3"
                >
                  <Bot className="size-4 shrink-0 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200 truncate">{task.title}</p>
                    <p className="text-xs text-zinc-500">
                      {entity?.logoEmoji} {entity?.name ?? "—"} → {project?.name ?? "—"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-800/50 text-amber-400 text-[10px] shrink-0"
                  >
                    {task.priority}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="border-t border-zinc-800/60 pt-6">
        <h2 className="mb-4 text-sm font-medium text-zinc-400">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
            render={<Link href="/chat" />}
          >
            <Bot className="size-3.5" />
            Ask Octane AI
            <ChevronRight className="size-3 opacity-50" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
            render={<Link href="/agents" />}
          >
            <Activity className="size-3.5" />
            Agent Control Center
            <ChevronRight className="size-3 opacity-50" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
            render={<Link href="/finance" />}
          >
            <TrendingUp className="size-3.5" />
            Portfolio Finance
            <ChevronRight className="size-3 opacity-50" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-700 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
            render={<Link href="/holdings" />}
          >
            <Globe className="size-3.5" />
            Holdings & Compliance
            <ChevronRight className="size-3 opacity-50" />
          </Button>
        </div>
      </div>
    </div>
  );
}
