"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Archive,
  CheckSquare,
  Inbox,
  NotebookPen,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog, EmptyState, SectionHeader } from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { InboxItem, InboxItemStatus, InboxItemType } from "@/lib/types";

const INBOX_TYPES: InboxItemType[] = [
  "idea",
  "task",
  "decision",
  "risk",
  "note",
  "document",
  "finance",
  "other",
];

const STATUS_SECTIONS: { status: InboxItemStatus; title: string }[] = [
  { status: "unprocessed", title: "Unprocessed" },
  { status: "converted", title: "Converted" },
  { status: "archived", title: "Archived" },
];

const emptyCapture = {
  title: "",
  body: "",
  type: "idea" as InboxItemType,
  linkedProjectId: "",
};

function InboxPageContent() {
  const titleRef = useRef<HTMLInputElement>(null);

  const inboxItems = useOctaneStore((s) => s.inboxItems);
  const projects = useOctaneStore((s) => s.projects);
  const createInboxItem = useOctaneStore((s) => s.createInboxItem);
  const convertInboxItemToTask = useOctaneStore((s) => s.convertInboxItemToTask);
  const convertInboxItemToDecision = useOctaneStore(
    (s) => s.convertInboxItemToDecision,
  );
  const convertInboxItemToFounderNote = useOctaneStore(
    (s) => s.convertInboxItemToFounderNote,
  );
  const archiveInboxItem = useOctaneStore((s) => s.archiveInboxItem);
  const deleteInboxItem = useOctaneStore((s) => s.deleteInboxItem);
  const getProjectById = useOctaneStore((s) => s.getProjectById);

  const [capture, setCapture] = useState(emptyCapture);
  const [deleteTarget, setDeleteTarget] = useState<InboxItem | null>(null);

  // Read URL params once on mount — avoids loop from useSearchParams()
  // returning new references during Next.js App Router hydration.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      titleRef.current?.focus();
    }
  }, []);

  const grouped = useMemo(() => {
    const buckets: Record<InboxItemStatus, InboxItem[]> = {
      unprocessed: [],
      converted: [],
      archived: [],
    };
    for (const item of inboxItems) {
      buckets[item.status].push(item);
    }
    for (const status of Object.keys(buckets) as InboxItemStatus[]) {
      buckets[status].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
    return buckets;
  }, [inboxItems]);

  const handleCapture = (event: React.FormEvent) => {
    event.preventDefault();
    if (!capture.title.trim()) return;

    createInboxItem({
      title: capture.title.trim(),
      body: capture.body.trim() || undefined,
      type: capture.type,
      status: "unprocessed",
      linkedProjectId: capture.linkedProjectId || undefined,
    });
    setCapture(emptyCapture);
    toast.success("Captured to inbox");
  };

  const handleConvertTask = (item: InboxItem) => {
    const task = convertInboxItemToTask(item.id);
    if (task) {
      toast.success("Converted to task", { description: task.title });
    } else {
      toast.error("Could not convert — item may already be processed");
    }
  };

  const handleConvertDecision = (item: InboxItem) => {
    const decision = convertInboxItemToDecision(item.id);
    if (decision) {
      toast.success("Converted to decision", { description: decision.title });
    } else {
      toast.error("Could not convert — item may already be processed");
    }
  };

  const handleConvertNote = (item: InboxItem) => {
    const note = convertInboxItemToFounderNote(item.id);
    if (note) {
      toast.success("Converted to founder note", { description: note.title });
    } else {
      toast.error("Could not convert — item may already be processed");
    }
  };

  return (
    <div className="space-y-8" data-page="inbox">
      <PageHeader
        title="Inbox"
        description="Quick capture for ideas, risks, and loose threads — convert when ready."
      />

      <Card
        className="border-zinc-800/80 bg-zinc-900/30"
        data-section="inbox-quick-add"
      >
        <CardContent className="pt-4">
          <form
            id="inbox-capture-form"
            onSubmit={handleCapture}
            className="grid gap-3"
          >
            <div className="grid gap-2">
              <Label htmlFor="inbox-capture-title">Quick capture</Label>
              <Input
                ref={titleRef}
                id="inbox-capture-title"
                placeholder="What’s on your mind?"
                value={capture.title}
                onChange={(event) =>
                  setCapture((prev) => ({ ...prev, title: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
                required
              />
            </div>
            <textarea
              id="inbox-capture-body"
              rows={2}
              placeholder="Optional details…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={capture.body}
              onChange={(event) =>
                setCapture((prev) => ({ ...prev, body: event.target.value }))
              }
            />
            <div className="flex flex-wrap gap-3">
              <select
                id="inbox-capture-type"
                className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
                value={capture.type}
                onChange={(event) =>
                  setCapture((prev) => ({
                    ...prev,
                    type: event.target.value as InboxItemType,
                  }))
                }
              >
                {INBOX_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {formatStatusLabel(type)}
                  </option>
                ))}
              </select>
              <select
                id="inbox-capture-project"
                className="h-8 min-w-[10rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100"
                value={capture.linkedProjectId}
                onChange={(event) =>
                  setCapture((prev) => ({
                    ...prev,
                    linkedProjectId: event.target.value,
                  }))
                }
              >
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <Button type="submit" id="inbox-capture-submit">
                <Plus className="size-4" />
                Add to inbox
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {inboxItems.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Inbox is clear"
          description="Capture ideas, risks, and loose threads before they become tasks. Use quick capture above, then convert items when you're ready to act."
        />
      ) : null}

      {STATUS_SECTIONS.map(({ status, title }) => {
        const items = grouped[status];
        return (
          <section
            key={status}
            className="space-y-4"
            data-section={`inbox-${status}`}
          >
            <SectionHeader
              title={title}
              description={`${items.length} item${items.length === 1 ? "" : "s"}`}
            />
            {items.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title={`No ${title.toLowerCase()} items`}
                description="Items move here as you capture, convert, or archive from the inbox."
                className="py-8"
              />
            ) : (
              <ul className="space-y-3" data-list={`inbox-${status}`}>
                {items.map((item) => {
                  const project = item.linkedProjectId
                    ? getProjectById(item.linkedProjectId)
                    : undefined;
                  return (
                    <li key={item.id} data-inbox-item={item.id}>
                      <Card className="border-zinc-800/80 bg-zinc-900/40">
                        <CardContent className="space-y-3 pt-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <h3 className="font-medium text-zinc-100">
                                {item.title}
                              </h3>
                              {item.body ? (
                                <p className="text-sm text-zinc-400">
                                  {item.body}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge
                                variant="outline"
                                className="border-zinc-700 text-zinc-300"
                              >
                                {formatStatusLabel(item.type)}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="border-zinc-700 text-zinc-400"
                              >
                                {formatStatusLabel(item.status)}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                            <span>
                              {format(
                                new Date(item.updatedAt),
                                "MMM d, yyyy",
                              )}
                            </span>
                            {project ? <span>{project.name}</span> : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {status === "unprocessed" ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="border-zinc-700"
                                  data-action="convert-task"
                                  onClick={() => handleConvertTask(item)}
                                >
                                  <CheckSquare className="size-3.5" />
                                  Task
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="border-zinc-700"
                                  data-action="convert-decision"
                                  onClick={() => handleConvertDecision(item)}
                                >
                                  <Scale className="size-3.5" />
                                  Decision
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="border-zinc-700"
                                  data-action="convert-note"
                                  onClick={() => handleConvertNote(item)}
                                >
                                  <NotebookPen className="size-3.5" />
                                  Note
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-zinc-400"
                                  data-action="archive"
                                  onClick={() => {
                                    archiveInboxItem(item.id);
                                    toast.info("Archived");
                                  }}
                                >
                                  <Archive className="size-3.5" />
                                  Archive
                                </Button>
                              </>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-red-400 hover:text-red-300"
                              data-action="delete"
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete inbox item?"
        description="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteInboxItem(deleteTarget.id);
            toast.success("Deleted");
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <InboxPageContent />
    </Suspense>
  );
}
