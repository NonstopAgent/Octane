"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { ProjectConnectionKind } from "@/lib/types/project-connection";

type ProjectLinkFormProps = {
  defaultProjectId?: string;
  compact?: boolean;
};

export function ProjectLinkForm({
  defaultProjectId,
  compact = false,
}: ProjectLinkFormProps) {
  const projects = useOctaneStore((s) => s.projects);
  const projectConnections = useOctaneStore((s) => s.projectConnections);
  const createProjectConnection = useOctaneStore((s) => s.createProjectConnection);
  const updateProjectConnection = useOctaneStore((s) => s.updateProjectConnection);
  const recordActivity = useOctaneStore((s) => s.recordActivity);

  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [kind, setKind] = useState<ProjectConnectionKind>("github");
  const [resource, setResource] = useState("");
  const [saving, setSaving] = useState(false);

  async function validateResource(): Promise<boolean> {
    if (kind === "github") {
      const repo = resource.trim();
      if (!repo.includes("/")) {
        toast.error("Use owner/repo format for GitHub");
        recordActivity({
          action: "updated",
          entityType: "system",
          entityName: "GitHub link",
          description: `Validation failed: invalid repo format "${repo}"`,
        });
        return false;
      }
      const res = await fetch(
        `/api/integrations/github/repo?repo=${encodeURIComponent(repo)}`,
      );
      if (!res.ok) {
        toast.error("Repo not found or GitHub token not configured");
        recordActivity({
          action: "updated",
          entityType: "system",
          entityName: "GitHub link",
          description: `Validation failed for ${repo}`,
        });
        return false;
      }
      return true;
    }

    if (kind === "vercel") {
      const name = resource.trim();
      const res = await fetch(
        `/api/integrations/vercel/project?name=${encodeURIComponent(name)}`,
      );
      if (!res.ok) {
        toast.error("Vercel project not found or token not configured");
        recordActivity({
          action: "updated",
          entityType: "system",
          entityName: "Vercel link",
          description: `Validation failed for ${name}`,
        });
        return false;
      }
      return true;
    }

    return true;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId || !resource.trim()) return;

    setSaving(true);
    try {
      const ok = await validateResource();
      if (!ok) return;

      const label =
        kind === "github"
          ? resource.trim()
          : kind === "vercel"
            ? resource.trim()
            : resource.trim();

      const existing = projectConnections.find(
        (pc) => pc.projectId === projectId && pc.kind === kind,
      );

      if (existing) {
        updateProjectConnection(existing.id, {
          label,
          repo: kind === "github" ? resource.trim() : undefined,
          url:
            kind === "vercel"
              ? `https://vercel.com/${resource.trim()}`
              : kind === "github"
                ? `https://github.com/${resource.trim()}`
                : resource.trim(),
          status: "linked",
        });
        recordActivity({
          action: "updated",
          entityType: "project",
          entityId: projectId,
          entityName: label,
          description: `Updated ${kind} project link`,
        });
        toast.success("Project link updated");
      } else {
        createProjectConnection({
          projectId,
          kind,
          label,
          repo: kind === "github" ? resource.trim() : undefined,
          url:
            kind === "vercel"
              ? `https://vercel.com`
              : kind === "github"
                ? `https://github.com/${resource.trim()}`
                : resource.trim(),
          status: "linked",
        });
        toast.success("Project link saved");
      }
      setResource("");
    } finally {
      setSaving(false);
    }
  }

  const resourcePlaceholder =
    kind === "github"
      ? "owner/repo"
      : kind === "vercel"
        ? "project-name"
        : "https://…";

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={
        compact
          ? "space-y-2"
          : "space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3"
      }
    >
      {!compact ? (
        <p className="text-xs text-zinc-500">
          Validates via read-only API before saving. No deploy or repo mutations.
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs text-zinc-500">Project</Label>
          <Select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border-zinc-700 bg-zinc-900"
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-zinc-500">Provider</Label>
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as ProjectConnectionKind)}
            className="border-zinc-700 bg-zinc-900"
          >
            <option value="github">GitHub</option>
            <option value="vercel">Vercel</option>
            <option value="website">Website</option>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs text-zinc-500">
          {kind === "github" ? "Repository" : kind === "vercel" ? "Vercel project" : "URL"}
        </Label>
        <Input
          value={resource}
          onChange={(e) => setResource(e.target.value)}
          placeholder={resourcePlaceholder}
          className="border-zinc-700 bg-zinc-900 font-mono text-sm"
          required
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={saving || !projectId}
        className="border-zinc-700"
        variant="outline"
      >
        <Link2 className="size-3.5" />
        {saving ? "Validating…" : "Save link"}
      </Button>
    </form>
  );
}
