"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTask, updateTask } from "@/lib/data/tasks";
import { useOctaneStore } from "@/lib/store/octane-store";
import type {
  Task,
  TaskAssignee,
  TaskPriority,
  TaskStatus,
} from "@/lib/types";

import {
  TASK_ASSIGNEES,
  TASK_DIFFICULTIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "./task-utils";

type TaskFormProps = {
  task?: Task;
  onSuccess: (task: Task) => void;
  onCancel: () => void;
};

type TaskFormValues = {
  title: string;
  description: string;
  projectId: string;
  assignedTo: TaskAssignee;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  tagsText: string;
  difficulty: "" | "easy" | "medium" | "hard";
};

const defaultValues: TaskFormValues = {
  title: "",
  description: "",
  projectId: "",
  assignedTo: "Logan",
  priority: "medium",
  status: "backlog",
  dueDate: "",
  tagsText: "",
  difficulty: "",
};

export function TaskForm({ task, onSuccess, onCancel }: TaskFormProps) {
  const projects = useOctaneStore((s) => s.projects);
  const [form, setForm] = useState(defaultValues);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!task) {
      setForm({
        ...defaultValues,
        projectId: projects[0]?.id ?? "",
      });
      return;
    }
    setForm({
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      assignedTo: task.assignedTo,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate?.slice(0, 10) ?? "",
      tagsText: task.tags.join(", "),
      difficulty: task.difficulty ?? "",
    });
  }, [task, projects]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.projectId) return;

    setSaving(true);
    const tags = form.tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      projectId: form.projectId,
      assignedTo: form.assignedTo,
      priority: form.priority,
      status: form.status,
      dueDate: form.dueDate || undefined,
      tags,
      difficulty: form.difficulty || undefined,
    };

    try {
      if (task) {
        await updateTask(task.id, payload);
        onSuccess({ ...task, ...payload });
      } else {
        const created = await createTask(payload);
        onSuccess(created);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={3}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="task-project">Project</Label>
          <Select
            id="task-project"
            value={form.projectId}
            onChange={(e) =>
              setForm((f) => ({ ...f, projectId: e.target.value }))
            }
            required
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-status">Status</Label>
          <Select
            id="task-status"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                status: e.target.value as typeof form.status,
              }))
            }
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-priority">Priority</Label>
          <Select
            id="task-priority"
            value={form.priority}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                priority: e.target.value as typeof form.priority,
              }))
            }
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-assignee">Assignee</Label>
          <Select
            id="task-assignee"
            value={form.assignedTo}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                assignedTo: e.target.value as typeof form.assignedTo,
              }))
            }
          >
            {TASK_ASSIGNEES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-due">Due date</Label>
          <Input
            id="task-due"
            type="date"
            value={form.dueDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, dueDate: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-difficulty">Difficulty</Label>
          <Select
            id="task-difficulty"
            value={form.difficulty}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                difficulty: e.target.value as typeof form.difficulty,
              }))
            }
          >
            <option value="">—</option>
            {TASK_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="task-tags">Tags (comma-separated)</Label>
          <Input
            id="task-tags"
            value={form.tagsText}
            onChange={(e) =>
              setForm((f) => ({ ...f, tagsText: e.target.value }))
            }
            placeholder="ops, mvp, auth"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || !projects.length}>
          {saving ? "Saving…" : task ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
