"use client";

import { useMemo, useState } from "react";
import { HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";

import { ConfirmDialog, EmptyState } from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOctaneStore } from "@/lib/store/octane-store";
import type {
  LegalQuestion,
  LegalQuestionPriority,
  LegalQuestionStatus,
} from "@/lib/types";

import { HoldingsSection } from "./holdings-section";

const STATUSES: LegalQuestionStatus[] = [
  "open",
  "researching",
  "answered",
  "deferred",
];

const PRIORITIES: LegalQuestionPriority[] = ["low", "medium", "high"];

const DISCLAIMER =
  "Internal organizer only. These notes are not legal advice. Confirm everything with qualified counsel.";

type Props = {
  openCreate?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  detailId?: string | null;
};

export function LegalQuestionsSection({
  openCreate = false,
  onCreateOpenChange,
  detailId,
}: Props) {
  const questions = useOctaneStore((s) => s.legalQuestions);
  const entities = useOctaneStore((s) => s.entities);
  const projects = useOctaneStore((s) => s.projects);
  const createLegalQuestion = useOctaneStore((s) => s.createLegalQuestion);
  const updateLegalQuestion = useOctaneStore((s) => s.updateLegalQuestion);
  const deleteLegalQuestion = useOctaneStore((s) => s.deleteLegalQuestion);

  const [dialogOpen, setDialogOpen] = useState(openCreate);
  const [editing, setEditing] = useState<LegalQuestion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LegalQuestion | null>(null);
  const [form, setForm] = useState({
    question: "",
    context: "",
    status: "open" as LegalQuestionStatus,
    priority: "medium" as LegalQuestionPriority,
    entityId: "",
    projectId: "",
    notes: "",
  });

  const entityName = useMemo(
    () => new Map(entities.map((e) => [e.id, e.name])),
    [entities],
  );
  const projectName = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const sorted = useMemo(
    () =>
      [...questions].sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return (
          priorityOrder[a.priority] - priorityOrder[b.priority] ||
          a.question.localeCompare(b.question)
        );
      }),
    [questions],
  );

  const openDialog = (item?: LegalQuestion) => {
    if (item) {
      setEditing(item);
      setForm({
        question: item.question,
        context: item.context ?? "",
        status: item.status,
        priority: item.priority,
        entityId: item.entityId ?? "",
        projectId: item.projectId ?? "",
        notes: item.notes ?? "",
      });
    } else {
      setEditing(null);
      setForm({
        question: "",
        context: "",
        status: "open",
        priority: "medium",
        entityId: "",
        projectId: "",
        notes: "",
      });
    }
    setDialogOpen(true);
    onCreateOpenChange?.(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    onCreateOpenChange?.(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.question.trim()) return;
    const payload = {
      question: form.question.trim(),
      context: form.context || undefined,
      status: form.status,
      priority: form.priority,
      entityId: form.entityId || undefined,
      projectId: form.projectId || undefined,
      notes: form.notes || undefined,
    };
    if (editing) {
      updateLegalQuestion(editing.id, payload);
    } else {
      createLegalQuestion(payload);
    }
    closeDialog();
  };

  return (
    <HoldingsSection
      id="legal-questions"
      title="Legal questions"
      description={DISCLAIMER}
      icon={HelpCircle}
    >
      <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
        {DISCLAIMER}
      </p>

      <div className="mb-3 flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => openDialog()}>
          <Plus className="size-3.5" />
          Log question
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No legal questions logged"
          description="Track open items to discuss with counsel — not a substitute for advice."
          action={{ label: "Log question", onClick: () => openDialog() }}
        />
      ) : (
        <ul className="space-y-2">
          {sorted.map((item) => (
            <li
              key={item.id}
              className={
                item.id === detailId
                  ? "rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
                  : "rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2"
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-zinc-100">{item.question}</p>
                  {item.context ? (
                    <p className="mt-1 text-sm text-zinc-400">{item.context}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-500">
                    {item.entityId
                      ? entityName.get(item.entityId)
                      : item.projectId
                        ? projectName.get(item.projectId)
                        : "General"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-zinc-700">
                    {formatStatusLabel(item.priority)}
                  </Badge>
                  <Badge variant="outline" className="border-zinc-700">
                    {formatStatusLabel(item.status)}
                  </Badge>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => openDialog(item)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-red-300"
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen || openCreate} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit legal question" : "Log legal question"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-2">
                <Label htmlFor="legal-question">Question</Label>
                <textarea
                  id="legal-question"
                  rows={2}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  value={form.question}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, question: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <select
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        status: e.target.value as LegalQuestionStatus,
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
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <select
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        priority: e.target.value as LegalQuestionPriority,
                      }))
                    }
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {formatStatusLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete question?"
        description="Remove this organizer entry (not legal advice)."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteLegalQuestion(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </HoldingsSection>
  );
}
