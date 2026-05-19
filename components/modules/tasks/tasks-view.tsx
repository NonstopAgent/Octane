"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanSquare, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/modules";
import { Button } from "@/components/ui/button";
import { moveTaskStatus } from "@/lib/data/tasks";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Task, TaskStatus } from "@/lib/types";

import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { TaskFilters, type TaskFiltersState } from "./task-filters";
import { TaskDetailSheet } from "./task-detail-sheet";
import { TaskFormDialog } from "./task-form-dialog";
import { isTaskStatus, KANBAN_COLUMNS } from "./task-utils";

export function TasksView() {
  const searchParams = useSearchParams();
  const tasks = useOctaneStore((s) => s.tasks);
  const projects = useOctaneStore((s) => s.projects);
  const [filters, setFilters] = useState<TaskFiltersState>({
    projectId: "all",
    priority: "all",
    assignee: "all",
    status: "all",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [dndEnabled, setDndEnabled] = useState(true);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true);
    }
    const detail = searchParams.get("detail");
    if (detail) {
      setDetailId(detail);
      setDetailOpen(true);
    }
  }, [searchParams]);

  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filters.projectId !== "all" && t.projectId !== filters.projectId)
        return false;
      if (filters.priority !== "all" && t.priority !== filters.priority)
        return false;
      if (filters.assignee !== "all" && t.assignedTo !== filters.assignee)
        return false;
      if (filters.status !== "all" && t.status !== filters.status) return false;
      return true;
    });
  }, [tasks, filters]);

  const columns = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      backlog: [],
      ready: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    for (const task of filtered) {
      map[task.status].push(task);
    }
    for (const status of Object.keys(map) as TaskStatus[]) {
      map[status].sort((a, b) => a.title.localeCompare(b.title));
    }
    return map;
  }, [filtered]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !active) return;

    const targetStatus = String(over.id);
    if (!isTaskStatus(targetStatus)) return;

    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    try {
      await moveTaskStatus(taskId, targetStatus);
    } catch {
      setDndEnabled(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Kanban board with drag-and-drop and persisted status updates."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New Task
          </Button>
        }
      />

      <TaskFilters
        filters={filters}
        onChange={setFilters}
        projectOptions={projects.map((p) => ({ id: p.id, name: p.name }))}
      />

      {!dndEnabled ? (
        <p className="text-xs text-amber-400/90">
          Drag-and-drop paused — use the status dropdown on each card to move
          tasks.
        </p>
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="No tasks yet"
          description="Tasks are the unit of execution across projects. Add your first task to populate the kanban board and track work from backlog to done."
          action={{
            label: "New Task",
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          title="No tasks match"
          description="Adjust filters to see tasks, or create a new one."
          action={{
            label: "New Task",
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : (
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-w-0 gap-3 overflow-x-auto pb-4 snap-x snap-mandatory">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              status={col.id}
              label={col.label}
              tasks={columns[col.id]}
              projectNames={projectNames}
              dragEnabled={dndEnabled}
              onTaskClick={(task) => {
                setDetailId(task.id);
                setDetailOpen(true);
              }}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="w-[260px] opacity-95">
              <TaskCard
                task={activeTask}
                projectName={projectNames[activeTask.projectId] ?? "Unknown"}
                dragEnabled={false}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      <TaskFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => setCreateOpen(false)}
      />

      <TaskDetailSheet
        taskId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
