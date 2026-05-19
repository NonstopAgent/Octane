"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { TaskAssignee, TaskPriority, TaskStatus } from "@/lib/types";

import { TASK_ASSIGNEES, TASK_PRIORITIES, TASK_STATUSES } from "./task-utils";

export type TaskFiltersState = {
  projectId: string | "all";
  priority: TaskPriority | "all";
  assignee: TaskAssignee | "all";
  status: TaskStatus | "all";
};

type TaskFiltersProps = {
  filters: TaskFiltersState;
  onChange: (filters: TaskFiltersState) => void;
  projectOptions: { id: string; name: string }[];
};

export function TaskFilters({
  filters,
  onChange,
  projectOptions,
}: TaskFiltersProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="task-filter-project" className="text-zinc-500">
          Project
        </Label>
        <Select
          id="task-filter-project"
          value={filters.projectId}
          onChange={(e) =>
            onChange({
              ...filters,
              projectId: e.target.value as TaskFiltersState["projectId"],
            })
          }
        >
          <option value="all">All projects</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="task-filter-priority" className="text-zinc-500">
          Priority
        </Label>
        <Select
          id="task-filter-priority"
          value={filters.priority}
          onChange={(e) =>
            onChange({
              ...filters,
              priority: e.target.value as TaskFiltersState["priority"],
            })
          }
        >
          <option value="all">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="task-filter-assignee" className="text-zinc-500">
          Assignee
        </Label>
        <Select
          id="task-filter-assignee"
          value={filters.assignee}
          onChange={(e) =>
            onChange({
              ...filters,
              assignee: e.target.value as TaskFiltersState["assignee"],
            })
          }
        >
          <option value="all">All assignees</option>
          {TASK_ASSIGNEES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="task-filter-status" className="text-zinc-500">
          Status
        </Label>
        <Select
          id="task-filter-status"
          value={filters.status}
          onChange={(e) =>
            onChange({
              ...filters,
              status: e.target.value as TaskFiltersState["status"],
            })
          }
        >
          <option value="all">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
