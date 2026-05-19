"use client";

import { useEffect, useState } from "react";

import { formatStatusLabel } from "@/components/modules/badge-tones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOctaneStore } from "@/lib/store/octane-store";
import type {
  ProjectPriority,
  RoadmapItem,
  RoadmapItemStatus,
  RoadmapTimeframe,
} from "@/lib/types";

const TIMEFRAMES: RoadmapTimeframe[] = ["now", "next", "later", "someday"];
const STATUSES: RoadmapItemStatus[] = [
  "planned",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];
const PRIORITIES: ProjectPriority[] = ["low", "medium", "high", "critical"];

type RoadmapFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: RoadmapItem;
  onSaved?: () => void;
};

const emptyForm = {
  title: "",
  description: "",
  projectId: "",
  timeframe: "next" as RoadmapTimeframe,
  priority: "medium" as ProjectPriority,
  targetDate: "",
  status: "planned" as RoadmapItemStatus,
  dependenciesText: "",
  expectedImpact: "",
};

export function RoadmapFormDialog({
  open,
  onOpenChange,
  item,
  onSaved,
}: RoadmapFormDialogProps) {
  const projects = useOctaneStore((s) => s.projects);
  const createRoadmapItem = useOctaneStore((s) => s.createRoadmapItem);
  const updateRoadmapItem = useOctaneStore((s) => s.updateRoadmapItem);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        title: item.title,
        description: item.description,
        projectId: item.projectId ?? "",
        timeframe: item.timeframe,
        priority: item.priority,
        targetDate: item.targetDate?.slice(0, 10) ?? "",
        status: item.status,
        dependenciesText: item.dependencies.join(", "),
        expectedImpact: item.expectedImpact ?? "",
      });
    } else {
      setForm({ ...emptyForm, projectId: projects[0]?.id ?? "" });
    }
  }, [open, item, projects]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      projectId: form.projectId || undefined,
      timeframe: form.timeframe,
      priority: form.priority,
      targetDate: form.targetDate || undefined,
      status: form.status,
      dependencies: form.dependenciesText
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
      expectedImpact: form.expectedImpact || undefined,
    };

    if (item) {
      updateRoadmapItem(item.id, payload);
    } else {
      createRoadmapItem(payload);
    }
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit roadmap item" : "New roadmap item"}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Strategic bets across time horizons.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid max-h-[70vh] gap-3 overflow-y-auto">
          <div className="grid gap-2">
            <Label htmlFor="road-title">Title</Label>
            <Input
              id="road-title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="border-zinc-700 bg-zinc-900"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="road-desc">Description</Label>
            <Textarea
              id="road-desc"
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="border-zinc-700 bg-zinc-900"
            />
          </div>
          <ProjectSelect form={form} setForm={setForm} projects={projects} />
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Timeframe</Label>
              <select
                className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
                value={form.timeframe}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    timeframe: e.target.value as RoadmapTimeframe,
                  }))
                }
              >
                {TIMEFRAMES.map((t) => (
                  <option key={t} value={t}>
                    {formatStatusLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <select
                className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as RoadmapItemStatus,
                  }))
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {formatStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Priority</Label>
              <select
                className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priority: e.target.value as ProjectPriority,
                  }))
                }
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="road-date">Target date</Label>
              <Input
                id="road-date"
                type="date"
                value={form.targetDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetDate: e.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="road-deps">Dependencies (comma-separated)</Label>
            <Input
              id="road-deps"
              value={form.dependenciesText}
              onChange={(e) =>
                setForm((f) => ({ ...f, dependenciesText: e.target.value }))
              }
              placeholder="Other roadmap item titles or IDs"
              className="border-zinc-700 bg-zinc-900"
            />
          </div>
          <DialogFooter className="border-zinc-800/80 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="border-zinc-700"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">{item ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectSelect({
  form,
  setForm,
  projects,
}: {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  projects: { id: string; name: string }[];
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="road-project">Project</Label>
      <select
        id="road-project"
        className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
        value={form.projectId}
        onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
      >
        <option value="">Portfolio (none)</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
