"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog, SectionHeader } from "@/components/modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { FounderNote } from "@/lib/types";

const emptyForm = {
  title: "",
  body: "",
  linkedProjectId: "",
  tags: "",
};

function NotesPageContent() {
  const searchParams = useSearchParams();
  const titleRef = useRef<HTMLInputElement>(null);

  const founderNotes = useOctaneStore((s) => s.founderNotes);
  const projects = useOctaneStore((s) => s.projects);
  const createFounderNote = useOctaneStore((s) => s.createFounderNote);
  const updateFounderNote = useOctaneStore((s) => s.updateFounderNote);
  const deleteFounderNote = useOctaneStore((s) => s.deleteFounderNote);
  const getFounderNoteById = useOctaneStore((s) => s.getFounderNoteById);
  const getProjectById = useOctaneStore((s) => s.getProjectById);

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<FounderNote | null>(null);
  const [selected, setSelected] = useState<FounderNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FounderNote | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setDialogOpen(true);
      setEditingNote(null);
      setForm(emptyForm);
      return;
    }
    const detail = searchParams.get("detail");
    if (detail) {
      const note = founderNotes.find((n) => n.id === detail);
      if (note) setSelected(note);
    }
  }, [searchParams, founderNotes]);

  useEffect(() => {
    if (dialogOpen) {
      titleRef.current?.focus();
    }
  }, [dialogOpen]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const note of founderNotes) {
      for (const tag of note.tags) {
        tags.add(tag);
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [founderNotes]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...founderNotes]
      .filter((note) => {
        if (projectFilter !== "all" && note.linkedProjectId !== projectFilter) {
          return false;
        }
        if (tagFilter !== "all" && !note.tags.includes(tagFilter)) {
          return false;
        }
        if (!query) return true;
        return (
          note.title.toLowerCase().includes(query) ||
          note.body.toLowerCase().includes(query) ||
          note.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [founderNotes, search, projectFilter, tagFilter]);

  const openCreate = () => {
    setEditingNote(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (note: FounderNote) => {
    setEditingNote(note);
    setForm({
      title: note.title,
      body: note.body,
      linkedProjectId: note.linkedProjectId ?? "",
      tags: note.tags.join(", "),
    });
    setDialogOpen(true);
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;

    const tags = form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (editingNote) {
      updateFounderNote(editingNote.id, {
        title: form.title.trim(),
        body: form.body.trim(),
        linkedProjectId: form.linkedProjectId || undefined,
        tags,
      });
      toast.success("Note updated");
    } else {
      createFounderNote({
        title: form.title.trim(),
        body: form.body.trim(),
        linkedProjectId: form.linkedProjectId || undefined,
        tags,
      });
      toast.success("Note created");
    }
    setDialogOpen(false);
    setForm(emptyForm);
    setEditingNote(null);
  };

  return (
    <div className="space-y-8" data-page="notes">
      <PageHeader
        title="Founder Notes"
        description="Private thinking space — strategy, positioning, and reminders."
        actions={
          <Button type="button" id="notes-new-button" onClick={openCreate}>
            <Plus className="size-4" />
            New Note
          </Button>
        }
      />

      <Card className="border-zinc-800/80 bg-zinc-900/30" data-section="notes-filters">
        <CardContent className="grid gap-4 pt-4 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <Search className="absolute top-2.5 left-2.5 size-4 text-zinc-500" />
            <Input
              id="notes-search"
              placeholder="Search notes…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="border-zinc-700 bg-zinc-900 pl-8"
            />
          </div>
          <select
            id="notes-filter-project"
            className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value="all">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            id="notes-filter-tag"
            className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            <option value="all">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <section className="space-y-4" data-section="notes-list">
        <SectionHeader
          title="Notes"
          description={`${filtered.length} note${filtered.length === 1 ? "" : "s"}`}
        />
        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">No notes match your filters.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" data-list="founder-notes">
            {filtered.map((note) => {
              const project = note.linkedProjectId
                ? getProjectById(note.linkedProjectId)
                : undefined;
              return (
                <li key={note.id} data-note-id={note.id}>
                  <Card
                    className="h-full cursor-pointer border-zinc-800/80 bg-zinc-900/40 transition-colors hover:border-zinc-700"
                    onClick={() => setSelected(note)}
                  >
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-zinc-100">
                          {note.title}
                        </h3>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-zinc-400"
                            data-action="edit-note"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEdit(note);
                            }}
                          >
                            <Pencil className="size-3.5" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-red-400"
                            data-action="delete-note"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(note);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </div>
                      <p className="line-clamp-3 text-sm text-zinc-400">
                        {note.body}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {note.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="border-zinc-700 text-zinc-400"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                        <span>
                          {format(new Date(note.updatedAt), "MMM d, yyyy")}
                        </span>
                        {project ? <span>{project.name}</span> : null}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 ring-zinc-800/80 sm:max-w-lg"
          data-dialog="note-form"
        >
          <DialogHeader>
            <DialogTitle>
              {editingNote ? "Edit Note" : "New Founder Note"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Capture thinking that does not belong in tasks or decisions yet.
            </DialogDescription>
          </DialogHeader>
          <form id="note-form" onSubmit={handleSave} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="note-title">Title</Label>
              <Input
                ref={titleRef}
                id="note-title"
                required
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note-body">Body</Label>
              <textarea
                id="note-body"
                required
                rows={5}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                value={form.body}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, body: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note-project">Project</Label>
              <select
                id="note-project"
                className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
                value={form.linkedProjectId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    linkedProjectId: event.target.value,
                  }))
                }
              >
                <option value="">None</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note-tags">Tags (comma-separated)</Label>
              <Input
                id="note-tags"
                value={form.tags}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, tags: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
                placeholder="strategy, gtm"
              />
            </div>
            <DialogFooter className="border-zinc-800/80 bg-zinc-900/40 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" id="note-form-submit">
                {editingNote ? "Save Changes" : "Create Note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto border-zinc-800 bg-zinc-950 sm:max-w-lg"
          data-sheet="note-detail"
        >
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-zinc-50">{selected.title}</SheetTitle>
                <SheetDescription className="text-zinc-400">
                  {selected.linkedProjectId
                    ? getProjectById(selected.linkedProjectId)?.name
                    : "No linked project"}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4 pt-0 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="border-zinc-700 text-zinc-400"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="whitespace-pre-wrap text-zinc-300">
                  {selected.body}
                </p>
                <p className="text-xs text-zinc-500">
                  Updated{" "}
                  {format(new Date(selected.updatedAt), "MMM d, yyyy h:mm a")}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-zinc-700"
                    onClick={() => {
                      openEdit(selected);
                      setSelected(null);
                    }}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete founder note?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteFounderNote(deleteTarget.id);
            toast.success("Note deleted");
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading notes…</p>}>
      <NotesPageContent />
    </Suspense>
  );
}
