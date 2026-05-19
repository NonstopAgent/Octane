"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { PriorityBadge } from "@/components/modules";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { moveTaskStatus } from "@/lib/data/tasks";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/lib/types";

import { formatDueDate, TASK_STATUSES } from "./task-utils";

type TaskCardProps = {
  task: Task;
  projectName: string;
  dragEnabled?: boolean;
  onOpen?: () => void;
};

export function TaskCard({
  task,
  projectName,
  dragEnabled = true,
  onOpen,
}: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      disabled: !dragEnabled,
      data: { task },
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  async function handleStatusChange(status: TaskStatus) {
    if (status !== task.status) {
      await moveTaskStatus(task.id, status);
    }
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3 shadow-sm",
        isDragging && "opacity-60 ring-2 ring-amber-500/40",
      )}
    >
      <div className="flex items-start gap-2">
        {dragEnabled ? (
          <button
            type="button"
            className="mt-0.5 cursor-grab text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
            aria-label="Drag task"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={cn(
                "text-sm font-medium text-zinc-100",
                onOpen && "cursor-pointer hover:text-amber-200",
              )}
              onClick={onOpen}
              onKeyDown={(e) => {
                if (onOpen && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onOpen();
                }
              }}
              role={onOpen ? "button" : undefined}
              tabIndex={onOpen ? 0 : undefined}
            >
              {task.title}
            </h4>
            <PriorityBadge priority={task.priority} />
          </div>
          {task.description ? (
            <p className="line-clamp-2 text-xs text-zinc-500">
              {task.description}
            </p>
          ) : null}
          <p className="text-xs text-zinc-400">
            <span className="text-zinc-600">Project · </span>
            {projectName}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span>{task.assignedTo}</span>
            <span className="text-zinc-700">·</span>
            <span>{formatDueDate(task.dueDate)}</span>
            {task.difficulty ? (
              <>
                <span className="text-zinc-700">·</span>
                <span className="capitalize">{task.difficulty}</span>
              </>
            ) : null}
          </div>
          {task.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="border-zinc-700/80 text-[10px] text-zinc-400"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
          <Select
            className="h-7 text-xs"
            value={task.status}
            onChange={(e) =>
              handleStatusChange(e.target.value as TaskStatus)
            }
            onClick={(e) => e.stopPropagation()}
            aria-label="Change task status"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </article>
  );
}
