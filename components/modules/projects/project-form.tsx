"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createProject, updateProject } from "@/lib/data/projects";
import type {
  Project,
  ProjectPriority,
  ProjectRevenueStatus,
  ProjectStatus,
} from "@/lib/types";

import {
  linesToList,
  listToLines,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  REVENUE_STATUSES,
} from "./project-utils";

type ProjectFormProps = {
  project?: Project;
  onSuccess: (project: Project) => void;
  onCancel: () => void;
};

type ProjectFormValues = {
  name: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  owner: string;
  progress: number;
  revenueStatus: ProjectRevenueStatus;
  currentPhase: string;
  goalsText: string;
  risksText: string;
  nextActionsText: string;
  revenueNotes: string;
};

const defaultValues: ProjectFormValues = {
  name: "",
  description: "",
  status: "idea",
  priority: "medium",
  owner: "Logan",
  progress: 0,
  revenueStatus: "none",
  currentPhase: "",
  goalsText: "",
  risksText: "",
  nextActionsText: "",
  revenueNotes: "",
};

export function ProjectForm({ project, onSuccess, onCancel }: ProjectFormProps) {
  const [form, setForm] = useState(defaultValues);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!project) {
      setForm(defaultValues);
      return;
    }
    setForm({
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      owner: project.owner,
      progress: project.progress,
      revenueStatus: project.revenueStatus,
      currentPhase: project.currentPhase ?? "",
      goalsText: listToLines(project.goals),
      risksText: listToLines(project.risks),
      nextActionsText: listToLines(project.nextActions),
      revenueNotes: project.revenueNotes ?? "",
    });
  }, [project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      owner: form.owner.trim() || "Logan",
      progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
      revenueStatus: form.revenueStatus,
      currentPhase: form.currentPhase.trim() || undefined,
      goals: linesToList(form.goalsText),
      risks: linesToList(form.risksText),
      nextActions: linesToList(form.nextActionsText),
      revenueNotes: form.revenueNotes.trim() || undefined,
    };

    try {
      if (project) {
        await updateProject(project.id, payload);
        onSuccess({ ...project, ...payload });
      } else {
        const created = await createProject(payload);
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
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-description">Description</Label>
          <Textarea
            id="project-description"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-status">Status</Label>
          <Select
            id="project-status"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                status: e.target.value as typeof form.status,
              }))
            }
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-priority">Priority</Label>
          <Select
            id="project-priority"
            value={form.priority}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                priority: e.target.value as typeof form.priority,
              }))
            }
          >
            {PROJECT_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-owner">Owner</Label>
          <Input
            id="project-owner"
            value={form.owner}
            onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-progress">Progress (%)</Label>
          <Input
            id="project-progress"
            type="number"
            min={0}
            max={100}
            value={form.progress}
            onChange={(e) =>
              setForm((f) => ({ ...f, progress: Number(e.target.value) }))
            }
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-revenue">Revenue status</Label>
          <Select
            id="project-revenue"
            value={form.revenueStatus}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                revenueStatus: e.target.value as typeof form.revenueStatus,
              }))
            }
          >
            {REVENUE_STATUSES.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-phase">Current phase</Label>
          <Input
            id="project-phase"
            value={form.currentPhase}
            onChange={(e) =>
              setForm((f) => ({ ...f, currentPhase: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-goals">Goals (one per line)</Label>
          <Textarea
            id="project-goals"
            value={form.goalsText}
            onChange={(e) =>
              setForm((f) => ({ ...f, goalsText: e.target.value }))
            }
            rows={3}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-risks">Risks (one per line)</Label>
          <Textarea
            id="project-risks"
            value={form.risksText}
            onChange={(e) =>
              setForm((f) => ({ ...f, risksText: e.target.value }))
            }
            rows={2}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-actions">Next actions (one per line)</Label>
          <Textarea
            id="project-actions"
            value={form.nextActionsText}
            onChange={(e) =>
              setForm((f) => ({ ...f, nextActionsText: e.target.value }))
            }
            rows={2}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="project-revenue-notes">Revenue notes</Label>
          <Textarea
            id="project-revenue-notes"
            value={form.revenueNotes}
            onChange={(e) =>
              setForm((f) => ({ ...f, revenueNotes: e.target.value }))
            }
            rows={2}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : project ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
