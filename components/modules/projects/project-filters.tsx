"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ProjectPriority, ProjectStatus } from "@/lib/types";

import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "./project-utils";

export type ProjectFiltersState = {
  search: string;
  status: ProjectStatus | "all";
  priority: ProjectPriority | "all";
};

type ProjectFiltersProps = {
  filters: ProjectFiltersState;
  onChange: (filters: ProjectFiltersState) => void;
};

export function ProjectFilters({ filters, onChange }: ProjectFiltersProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
        <Label htmlFor="project-search" className="text-zinc-500">
          Search
        </Label>
        <Input
          id="project-search"
          placeholder="Search projects…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="project-filter-status" className="text-zinc-500">
          Status
        </Label>
        <Select
          id="project-filter-status"
          value={filters.status}
          onChange={(e) =>
            onChange({
              ...filters,
              status: e.target.value as ProjectFiltersState["status"],
            })
          }
        >
          <option value="all">All statuses</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="project-filter-priority" className="text-zinc-500">
          Priority
        </Label>
        <Select
          id="project-filter-priority"
          value={filters.priority}
          onChange={(e) =>
            onChange({
              ...filters,
              priority: e.target.value as ProjectFiltersState["priority"],
            })
          }
        >
          <option value="all">All priorities</option>
          {PROJECT_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
