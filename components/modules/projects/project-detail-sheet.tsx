"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Landmark, NotebookPen, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { PriorityBadge, StatusBadge } from "@/components/modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Project } from "@/lib/types";

import { ProjectForm } from "./project-form";
import { formatRevenueStatus, formatUpdatedAt } from "./project-utils";

type ProjectDetailSheetProps = {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditRequest?: () => void;
};

function BulletList({
  title,
  items,
}: {
  title: string;
  items?: string[];
}) {
  if (!items?.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <ul className="list-inside list-disc space-y-1 text-sm text-zinc-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function ProjectDetailSheet({
  projectId,
  open,
  onOpenChange,
  onEditRequest,
}: ProjectDetailSheetProps) {
  const project = useOctaneStore((s) =>
    projectId ? s.projects.find((p) => p.id === projectId) : undefined,
  );
  const tasks = useOctaneStore((s) =>
    projectId ? s.tasks.filter((t) => t.projectId === projectId) : [],
  );
  const founderNotes = useOctaneStore((s) => s.founderNotes);
  const ipAssets = useOctaneStore((s) => s.ipAssets);
  const entities = useOctaneStore((s) => s.entities);
  const complianceReminders = useOctaneStore((s) => s.complianceReminders);
  const legalQuestions = useOctaneStore((s) => s.legalQuestions);
  const createFounderNote = useOctaneStore((s) => s.createFounderNote);
  const [editing, setEditing] = useState(false);
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => a.title.localeCompare(b.title)),
    [tasks],
  );

  const linkedNotes = useMemo(() => {
    if (!projectId) return [];
    return founderNotes
      .filter((note) => note.linkedProjectId === projectId)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [founderNotes, projectId]);

  const entityName = useMemo(
    () => new Map(entities.map((e) => [e.id, e.name])),
    [entities],
  );

  const projectIp = useMemo(
    () => (projectId ? ipAssets.filter((a) => a.projectId === projectId) : []),
    [ipAssets, projectId],
  );

  const projectCompliance = useMemo(
    () =>
      projectId
        ? complianceReminders.filter((r) => r.projectId === projectId)
        : [],
    [complianceReminders, projectId],
  );

  const projectLegal = useMemo(
    () =>
      projectId ? legalQuestions.filter((q) => q.projectId === projectId) : [],
    [legalQuestions, projectId],
  );

  const handleCreateLinkedNote = (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectId || !noteTitle.trim() || !noteBody.trim()) return;

    createFounderNote({
      title: noteTitle.trim(),
      body: noteBody.trim(),
      linkedProjectId: projectId,
      tags: ["project"],
    });
    setNoteTitle("");
    setNoteBody("");
    setNoteFormOpen(false);
    toast.success("Founder note linked to project");
  };

  if (!project) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Project</SheetTitle>
            <SheetDescription>Project not found.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEditing(false);
          setNoteFormOpen(false);
          setNoteTitle("");
          setNoteBody("");
        }
        onOpenChange(next);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b border-zinc-800/80 pb-4">
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="space-y-1">
              <SheetTitle>{project.name}</SheetTitle>
              <SheetDescription>{project.description}</SheetDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge domain="project" status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
          </div>
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-fit"
              onClick={() => {
                setEditing(true);
                onEditRequest?.();
              }}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          ) : null}
        </SheetHeader>

        {editing ? (
          <div className="p-4 pt-0">
            <ProjectForm
              project={project}
              onCancel={() => setEditing(false)}
              onSuccess={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="space-y-6 p-4 pt-0">
            <section className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Overview
              </h3>
              <div className="grid gap-2 text-sm text-zinc-300">
                <p>
                  <span className="text-zinc-500">Owner · </span>
                  {project.owner}
                </p>
                <p>
                  <span className="text-zinc-500">Revenue · </span>
                  {formatRevenueStatus(project.revenueStatus)}
                </p>
                <p>
                  <span className="text-zinc-500">Updated · </span>
                  {formatUpdatedAt(project.updatedAt)}
                </p>
              </div>
              <Progress value={project.progress} />
            </section>

            {project.currentPhase ? (
              <section className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Phase
                </h3>
                <p className="text-sm text-zinc-300">{project.currentPhase}</p>
              </section>
            ) : null}

            <BulletList title="Goals" items={project.goals} />
            <BulletList title="Risks" items={project.risks} />
            <BulletList title="Next actions" items={project.nextActions} />

            {project.revenueNotes ? (
              <section className="space-y-1">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Revenue notes
                </h3>
                <p className="text-sm text-zinc-300">{project.revenueNotes}</p>
              </section>
            ) : null}

            <Separator className="bg-zinc-800/80" />

            <section className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Linked tasks ({sortedTasks.length})
              </h3>
              {sortedTasks.length === 0 ? (
                <p className="text-sm text-zinc-500">No tasks for this project.</p>
              ) : (
                <ul className="space-y-2">
                  {sortedTasks.map((task) => (
                    <li
                      key={task.id}
                      className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-200">
                          {task.title}
                        </span>
                        <StatusBadge domain="task" status={task.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator className="bg-zinc-800/80" />

            <Separator className="bg-zinc-800/80" />

            <section className="space-y-3" data-section="project-holdings">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Holdings
                </h3>
                <Link
                  href="/holdings"
                  className="inline-flex items-center gap-1 text-xs text-amber-400/90 hover:underline"
                >
                  <Landmark className="size-3" />
                  Command center
                </Link>
              </div>
              {projectIp.length === 0 &&
              projectCompliance.length === 0 &&
              projectLegal.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No IP, compliance, or legal items linked to this project.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {projectIp.map((asset) => (
                    <li
                      key={asset.id}
                      className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2"
                    >
                      <span className="font-medium text-zinc-200">
                        {asset.name}
                      </span>
                      <span className="text-zinc-500">
                        {" "}
                        · {entityName.get(asset.ownerEntity) ?? asset.ownerEntity}
                      </span>
                    </li>
                  ))}
                  {projectCompliance.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2"
                    >
                      <span className="text-zinc-200">{item.title}</span>
                      <span className="text-zinc-500"> · due {item.dueDate}</span>
                    </li>
                  ))}
                  {projectLegal.map((q) => (
                    <li
                      key={q.id}
                      className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-zinc-300"
                    >
                      {q.question}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Separator className="bg-zinc-800/80" />

            <section
              className="space-y-3"
              data-section="project-founder-notes"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Founder notes ({linkedNotes.length})
                </h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-zinc-700"
                  data-action="create-linked-note"
                  onClick={() => setNoteFormOpen((open) => !open)}
                >
                  <Plus className="size-3.5" />
                  {noteFormOpen ? "Cancel" : "Add note"}
                </Button>
              </div>

              {noteFormOpen ? (
                <form
                  id="project-linked-note-form"
                  onSubmit={handleCreateLinkedNote}
                  className="space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="project-note-title">Title</Label>
                    <Input
                      id="project-note-title"
                      value={noteTitle}
                      onChange={(event) => setNoteTitle(event.target.value)}
                      className="border-zinc-700 bg-zinc-900"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="project-note-body">Body</Label>
                    <textarea
                      id="project-note-body"
                      rows={3}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                      value={noteBody}
                      onChange={(event) => setNoteBody(event.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" size="sm" id="project-note-submit">
                    <NotebookPen className="size-3.5" />
                    Save linked note
                  </Button>
                </form>
              ) : null}

              {linkedNotes.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No founder notes linked to this project.
                </p>
              ) : (
                <ul className="space-y-2" data-list="project-founder-notes">
                  {linkedNotes.map((note) => (
                    <li
                      key={note.id}
                      data-note-id={note.id}
                      className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-sm"
                    >
                      <p className="font-medium text-zinc-200">{note.title}</p>
                      <p className="mt-1 line-clamp-2 text-zinc-400">
                        {note.body}
                      </p>
                      {note.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {note.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="border-zinc-700 text-xs text-zinc-400"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
