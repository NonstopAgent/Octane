"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderKanban, LayoutGrid, List, Plus } from "lucide-react";

import { EmptyState } from "@/components/modules";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useOctaneStore } from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

import { ProjectCard } from "./project-card";
import { ProjectDetailSheet } from "./project-detail-sheet";
import { ProjectFilters, type ProjectFiltersState } from "./project-filters";
import { ProjectFormDialog } from "./project-form-dialog";

export function ProjectsView() {
  const searchParams = useSearchParams();
  const projects = useOctaneStore((s) => s.projects);
  const [filters, setFilters] = useState<ProjectFiltersState>({
    search: "",
    status: "all",
    priority: "all",
  });
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreateOpen(true);
    }
    const detail = searchParams.get("detail");
    if (detail) {
      setSelectedId(detail);
      setSheetOpen(true);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return projects.filter((p) => {
      if (filters.status !== "all" && p.status !== filters.status) return false;
      if (filters.priority !== "all" && p.priority !== filters.priority)
        return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.owner.toLowerCase().includes(q)
      );
    });
  }, [projects, filters]);

  function openProject(project: Project) {
    setSelectedId(project.id);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Portfolio view with filters, detail sheet, and persisted CRUD."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New Project
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
        <ProjectFilters filters={filters} onChange={setFilters} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-zinc-500">
            {filtered.length} of {projects.length} projects
          </p>
          <div className="flex rounded-lg border border-zinc-800/80 p-0.5">
            <Button
              type="button"
              variant={layout === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Grid view"
              onClick={() => setLayout("grid")}
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              type="button"
              variant={layout === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="List view"
              onClick={() => setLayout("list")}
            >
              <List className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Projects are your portfolio bets. Create a project to track goals, tasks, finance, and strategic decisions in one place."
          action={{
            label: "New Project",
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects match"
          description="Adjust filters or create a new project."
          action={{
            label: "New Project",
            onClick: () => setCreateOpen(true),
          }}
        />
      ) : (
        <div
          className={cn(
            layout === "grid"
              ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-3",
          )}
        >
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              layout={layout}
              onClick={() => openProject(project)}
            />
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={() => setCreateOpen(false)}
      />

      <ProjectFormDialog
        open={Boolean(editProject)}
        onOpenChange={(open) => {
          if (!open) setEditProject(undefined);
        }}
        project={editProject}
        onSaved={() => setEditProject(undefined)}
      />

      <ProjectDetailSheet
        projectId={selectedId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onEditRequest={() => {
          const p = projects.find((x) => x.id === selectedId);
          if (p) setEditProject(p);
        }}
      />
    </div>
  );
}
