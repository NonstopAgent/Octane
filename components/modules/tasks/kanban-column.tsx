"use client";

import { useDroppable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/lib/types";

import { TaskCard } from "./task-card";

type KanbanColumnProps = {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  projectNames: Record<string, string>;
  dragEnabled?: boolean;
  onTaskClick?: (task: Task) => void;
};

export function KanbanColumn({
  status,
  label,
  tasks,
  projectNames,
  dragEnabled = true,
  onTaskClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[320px] w-[min(100%,280px)] shrink-0 flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/30",
        isOver && "border-amber-600/50 bg-amber-950/10",
      )}
    >
      <header className="flex items-center justify-between border-b border-zinc-800/80 px-3 py-2.5">
        <h3 className="text-sm font-medium text-zinc-200">{label}</h3>
        <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-400">
          {tasks.length}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-xs text-zinc-600">Drop tasks here</p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projectName={projectNames[task.projectId] ?? "Unknown"}
              dragEnabled={dragEnabled}
              onOpen={onTaskClick ? () => onTaskClick(task) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
