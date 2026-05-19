"use client";

import { Check, RotateCcw } from "lucide-react";

import { PriorityBadge, StatusBadge } from "@/components/modules";
import { Button } from "@/components/ui/button";
import { moveTaskStatus } from "@/lib/data/tasks";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TodayTaskRow({
  task,
  projectName,
  meta,
  className,
}: {
  task: Task;
  projectName: string;
  meta?: string;
  className?: string;
}) {
  async function handleMarkDone() {
    await moveTaskStatus(task.id, "done");
  }

  async function handleUnblock() {
    await moveTaskStatus(task.id, "in_progress");
  }

  return (
    <li
      className={cn(
        "rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-zinc-100">{task.title}</p>
        {meta ? (
          <span className="text-xs font-medium text-amber-300/90">{meta}</span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-zinc-500">{projectName}</p>
      {task.blockerReason ? (
        <p className="mt-1 text-xs text-red-300/80">{task.blockerReason}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <StatusBadge domain="task" status={task.status} />
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {task.status !== "done" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 border-zinc-700 text-xs"
            onClick={() => void handleMarkDone()}
          >
            <Check className="size-3.5" aria-hidden />
            Mark done
          </Button>
        ) : null}
        {task.status === "blocked" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 border-zinc-700 text-xs"
            onClick={() => void handleUnblock()}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Move to in progress
          </Button>
        ) : null}
      </div>
    </li>
  );
}
