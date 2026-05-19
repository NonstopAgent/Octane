"use client";

import { useMemo, useState } from "react";
import { Plus, Scale, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { PriorityBadge, StatusBadge } from "@/components/modules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { updateTask } from "@/lib/data/tasks";
import { useOctaneStore } from "@/lib/store/octane-store";
import { createId } from "@/lib/store/utils";
import type { Decision, Task, TaskSubtask } from "@/lib/types";

import { TaskForm } from "./task-form";
import { formatDueDate } from "./task-utils";

type TaskDetailSheetProps = {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TaskDetailSheet({
  taskId,
  open,
  onOpenChange,
}: TaskDetailSheetProps) {
  const router = useRouter();
  const tasks = useOctaneStore((s) => s.tasks);
  const projects = useOctaneStore((s) => s.projects);
  const convertTaskToDecision = useOctaneStore((s) => s.convertTaskToDecision);
  const [editing, setEditing] = useState(false);

  const task = useMemo(
    () => (taskId ? tasks.find((t) => t.id === taskId) : undefined),
    [tasks, taskId],
  );

  const projectName = useMemo(() => {
    if (!task) return "";
    return projects.find((p) => p.id === task.projectId)?.name ?? "Unknown";
  }, [task, projects]);

  if (!task) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Task</SheetTitle>
            <SheetDescription>Task not found.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <TaskDetailBody
      task={task}
      projectName={projectName}
      editing={editing}
      setEditing={setEditing}
      open={open}
      onOpenChange={onOpenChange}
      convertTaskToDecision={convertTaskToDecision}
      router={router}
    />
  );
}

function TaskDetailBody({
  task,
  projectName,
  editing,
  setEditing,
  open,
  onOpenChange,
  convertTaskToDecision,
  router,
}: {
  task: Task;
  projectName: string;
  editing: boolean;
  setEditing: (v: boolean) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  convertTaskToDecision: (taskId: string) => Decision | undefined;
  router: ReturnType<typeof useRouter>;
}) {
  const subtasks = task.subtasks ?? [];

  async function saveSubtasks(next: TaskSubtask[]) {
    await updateTask(task.id, { subtasks: next });
  }

  async function saveField(data: Partial<Task>) {
    await updateTask(task.id, data);
  }

  function addSubtask() {
    const next: TaskSubtask[] = [
      ...subtasks,
      { id: createId("sub"), title: "New subtask", done: false },
    ];
    void saveSubtasks(next);
  }

  function toggleSubtask(id: string) {
    const next = subtasks.map((s) =>
      s.id === id ? { ...s, done: !s.done } : s,
    );
    void saveSubtasks(next);
  }

  function updateSubtaskTitle(id: string, title: string) {
    const next = subtasks.map((s) => (s.id === id ? { ...s, title } : s));
    void saveSubtasks(next);
  }

  function removeSubtask(id: string) {
    void saveSubtasks(subtasks.filter((s) => s.id !== id));
  }

  function handleConvertToDecision() {
    const decision = convertTaskToDecision(task.id);
    if (decision) {
      onOpenChange(false);
      router.push(`/decisions?detail=${encodeURIComponent(decision.id)}`);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setEditing(false);
        onOpenChange(next);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b border-zinc-800/80 pb-4">
          <SheetTitle>{task.title}</SheetTitle>
          <SheetDescription>
            {projectName} · {formatDueDate(task.dueDate)}
          </SheetDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <StatusBadge domain="task" status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          {!editing ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleConvertToDecision}
              >
                <Scale className="size-3.5" />
                Convert to decision
              </Button>
            </div>
          ) : null}
        </SheetHeader>

        {editing ? (
          <TaskFormPanel
            task={task}
            onCancel={() => setEditing(false)}
            onSuccess={() => setEditing(false)}
          />
        ) : (
          <div className="space-y-6 p-4 pt-0">
            {task.description ? (
              <p className="text-sm text-zinc-400">{task.description}</p>
            ) : null}

            <section className="space-y-2">
              <Label htmlFor="task-notes">Notes</Label>
              <Textarea
                id="task-notes"
                rows={3}
                defaultValue={task.notes ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (task.notes ?? "")) {
                    void saveField({ notes: e.target.value });
                  }
                }}
                placeholder="Context, links, handoff notes…"
              />
            </section>

            {task.status === "blocked" ? (
              <section className="space-y-2">
                <Label htmlFor="task-blocker">Blocker reason</Label>
                <Input
                  id="task-blocker"
                  defaultValue={task.blockerReason ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (task.blockerReason ?? "")) {
                      void saveField({ blockerReason: e.target.value });
                    }
                  }}
                  placeholder="What is blocking progress?"
                />
              </section>
            ) : null}

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Checklist</Label>
                <Button type="button" size="sm" variant="ghost" onClick={addSubtask}>
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>
              {subtasks.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Break work into subtasks for clearer progress.
                </p>
              ) : (
                <ul className="space-y-2">
                  {subtasks.map((sub) => (
                    <li key={sub.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={sub.done}
                        onChange={() => toggleSubtask(sub.id)}
                        className="rounded border-zinc-600"
                      />
                      <Input
                        value={sub.title}
                        onChange={(e) =>
                          updateSubtaskTitle(sub.id, e.target.value)
                        }
                        className="h-8 flex-1 text-sm"
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => removeSubtask(sub.id)}
                      >
                        <Trash2 className="size-3.5 text-zinc-500" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <Label htmlFor="task-doc-link">Linked document (placeholder)</Label>
              <Input
                id="task-doc-link"
                defaultValue={task.linkedDocument?.name ?? ""}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  void saveField({
                    linkedDocument: name
                      ? { name, placeholderId: task.linkedDocument?.placeholderId }
                      : undefined,
                  });
                }}
                placeholder="Document name or reference"
              />
              <p className="text-xs text-zinc-600">
                Full document linking ships in a later session.
              </p>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskFormPanel({
  task,
  onCancel,
  onSuccess,
}: {
  task: Task;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  return (
    <div className="p-4 pt-0">
      <TaskForm task={task} onCancel={onCancel} onSuccess={onSuccess} />
    </div>
  );
}
