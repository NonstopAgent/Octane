"use client";

import { PriorityBadge, StatusBadge } from "@/components/modules";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

import { formatRevenueStatus, formatUpdatedAt } from "./project-utils";

type ProjectCardProps = {
  project: Project;
  onClick: () => void;
  layout: "grid" | "list";
};

export function ProjectCard({ project, onClick, layout }: ProjectCardProps) {
  const isList = layout === "list";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "cursor-pointer border-zinc-800/80 bg-zinc-950/40 transition-colors hover:border-amber-700/40 hover:bg-zinc-900/50",
        isList && "flex-row items-stretch",
      )}
    >
      <CardHeader className={cn(isList && "flex-1 border-b-0 pb-0")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-zinc-50">{project.name || "Untitled project"}</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge domain="project" status={project.status} />
            <PriorityBadge priority={project.priority} />
          </div>
        </div>
        <CardDescription className="line-clamp-2">
          {project.description || "No description yet."}
        </CardDescription>
      </CardHeader>
      <CardContent
        className={cn(
          "space-y-3",
          isList && "flex min-w-[220px] flex-col justify-center border-l border-zinc-800/60",
        )}
      >
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Progress</span>
            <span className="text-zinc-300">{project.progress ?? 0}%</span>
          </div>
          <Progress value={project.progress ?? 0} />
        </div>
        <div
          className={cn(
            "grid gap-2 text-xs text-zinc-400",
            isList ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          <div>
            <span className="text-zinc-600">Owner · </span>
            {project.owner}
          </div>
          <div>
            <span className="text-zinc-600">Revenue · </span>
            {formatRevenueStatus(project.revenueStatus)}
          </div>
          <div className={cn(!isList && "col-span-2")}>
            <span className="text-zinc-600">Updated · </span>
            {formatUpdatedAt(project.updatedAt)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
