"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";

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
  ComplianceReminder,
  ComplianceReminderCategory,
  ComplianceReminderStatus,
} from "@/lib/types";

import { HoldingsSection } from "./holdings-section";

const CATEGORIES: ComplianceReminderCategory[] = [
  "annual_filing",
  "tax",
  "license",
  "insurance",
  "governance",
  "other",
];

const STATUSES: ComplianceReminderStatus[] = [
  "pending",
  "completed",
  "overdue",
  "cancelled",
];

type Props = {
  openCreate?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  detailId?: string | null;
};

export function ComplianceCalendarSection({
  openCreate = false,
  onCreateOpenChange,
  detailId,
}: Props) {
  const reminders = useOctaneStore((s) => s.complianceReminders);
  const entities = useOctaneStore((s) => s.entities);
  const projects = useOctaneStore((s) => s.projects);
  const createComplianceReminder = useOctaneStore((s) => s.createComplianceReminder);
  const updateComplianceReminder = useOctaneStore((s) => s.updateComplianceReminder);
  const deleteComplianceReminder = useOctaneStore((s) => s.deleteComplianceReminder);

  const [dialogOpen, setDialogOpen] = useState(openCreate);
  const [editing, setEditing] = useState<ComplianceReminder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ComplianceReminder | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: format(new Date(), "yyyy-MM-dd"),
    entityId: "",
    projectId: "",
    category: "other" as ComplianceReminderCategory,
    status: "pending" as ComplianceReminderStatus,
    notes: "",
  });

  const entityName = useMemo(
    () => new Map(entities.map((e) => [e.id, e.name])),
    [entities],
  );

  const sorted = useMemo(
    () =>
      [...reminders].sort(
        (a, b) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      ),
    [reminders],
  );

  const openDialog = (item?: ComplianceReminder) => {
    if (item) {
      setEditing(item);
      setForm({
        title: item.title,
        description: item.description ?? "",
        dueDate: item.dueDate.slice(0, 10),
        entityId: item.entityId ?? "",
        projectId: item.projectId ?? "",
        category: item.category,
        status: item.status,
        notes: item.notes ?? "",
      });
    } else {
      setEditing(null);
      setForm({
        title: "",
        description: "",
        dueDate: format(new Date(), "yyyy-MM-dd"),
        entityId: "",
        projectId: "",
        category: "other",
        status: "pending",
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
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description || undefined,
      dueDate: form.dueDate,
      entityId: form.entityId || undefined,
      projectId: form.projectId || undefined,
      category: form.category,
      status: form.status,
      notes: form.notes || undefined,
    };
    if (editing) {
      updateComplianceReminder(editing.id, payload);
    } else {
      createComplianceReminder(payload);
    }
    closeDialog();
  };

  return (
    <HoldingsSection
      id="compliance-calendar"
      title="Compliance calendar"
      description="Filings, renewals, and governance dates by entity."
      icon={CalendarClock}
    >
      <div className="mb-3 flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => openDialog()}>
          <Plus className="size-3.5" />
          Add reminder
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No compliance reminders"
          description="Track annual filings, tax dates, and insurance renewals."
          action={{ label: "Add reminder", onClick: () => openDialog() }}
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
                  <p className="font-medium text-zinc-100">{item.title}</p>
                  <p className="text-sm text-zinc-500">
                    Due {format(parseISO(item.dueDate), "MMM d, yyyy")}
                    {item.entityId
                      ? ` · ${entityName.get(item.entityId) ?? item.entityId}`
                      : ""}
                  </p>
                  {item.description ? (
                    <p className="mt-1 text-sm text-zinc-400">{item.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                    {formatStatusLabel(item.category)}
                  </Badge>
                  <Badge
                    className={
                      item.status === "overdue"
                        ? "bg-red-500/20 text-red-200"
                        : "bg-zinc-800 text-zinc-300"
                    }
                  >
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
                {editing ? "Edit reminder" : "New compliance reminder"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-2">
                <Label htmlFor="compliance-title">Title</Label>
                <Input
                  id="compliance-title"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  required
                  className="border-zinc-700 bg-zinc-900"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="compliance-due">Due date</Label>
                <Input
                  id="compliance-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                  required
                  className="border-zinc-700 bg-zinc-900"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <select
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        category: e.target.value as ComplianceReminderCategory,
                      }))
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {formatStatusLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <select
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        status: e.target.value as ComplianceReminderStatus,
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
              <div className="grid gap-2">
                <Label>Entity (optional)</Label>
                <select
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  value={form.entityId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, entityId: e.target.value }))
                  }
                >
                  <option value="">None</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Project (optional)</Label>
                <select
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  value={form.projectId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, projectId: e.target.value }))
                  }
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
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
        title="Delete reminder?"
        description={`Remove "${deleteTarget?.title}" from the calendar.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteComplianceReminder(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </HoldingsSection>
  );
}
