"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Pencil, Plus, Trash2 } from "lucide-react";

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
  FormationChecklistItem,
  FormationChecklistStatus,
} from "@/lib/types";

import { HoldingsSection } from "./holdings-section";

const STATUSES: FormationChecklistStatus[] = [
  "pending",
  "in_progress",
  "done",
  "blocked",
];

type Props = {
  openCreate?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  detailId?: string | null;
};

export function FormationChecklistSection({
  openCreate = false,
  onCreateOpenChange,
  detailId,
}: Props) {
  const items = useOctaneStore((s) => s.formationChecklistItems);
  const entities = useOctaneStore((s) => s.entities);
  const createFormationChecklistItem = useOctaneStore(
    (s) => s.createFormationChecklistItem,
  );
  const updateFormationChecklistItem = useOctaneStore(
    (s) => s.updateFormationChecklistItem,
  );
  const deleteFormationChecklistItem = useOctaneStore(
    (s) => s.deleteFormationChecklistItem,
  );

  const [dialogOpen, setDialogOpen] = useState(openCreate);
  const [editing, setEditing] = useState<FormationChecklistItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormationChecklistItem | null>(
    null,
  );
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "pending" as FormationChecklistStatus,
    entityId: "",
    sortOrder: "10",
    notes: "",
  });

  const entityName = useMemo(
    () => new Map(entities.map((e) => [e.id, e.name])),
    [entities],
  );

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
      ),
    [items],
  );

  const openDialog = (item?: FormationChecklistItem) => {
    if (item) {
      setEditing(item);
      setForm({
        title: item.title,
        description: item.description ?? "",
        status: item.status,
        entityId: item.entityId ?? "",
        sortOrder: String(item.sortOrder),
        notes: item.notes ?? "",
      });
    } else {
      setEditing(null);
      const nextOrder =
        items.reduce((max, i) => Math.max(max, i.sortOrder), 0) + 10;
      setForm({
        title: "",
        description: "",
        status: "pending",
        entityId: "",
        sortOrder: String(nextOrder),
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
      status: form.status,
      entityId: form.entityId || undefined,
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
      notes: form.notes || undefined,
    };
    if (editing) {
      updateFormationChecklistItem(editing.id, payload);
    } else {
      createFormationChecklistItem(payload);
    }
    closeDialog();
  };

  return (
    <HoldingsSection
      id="formation-checklist"
      title="Formation checklist"
      description="Entity formation and internal structure steps."
      icon={CheckSquare}
    >
      <div className="mb-3 flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => openDialog()}>
          <Plus className="size-3.5" />
          Add step
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="Formation checklist empty"
          description="Add steps for trust deed, EIN, bank account, and IP assignment."
          action={{ label: "Add step", onClick: () => openDialog() }}
        />
      ) : (
        <ul className="space-y-2">
          {sorted.map((item) => (
            <li
              key={item.id}
              className={
                item.id === detailId
                  ? "flex items-start justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2"
                  : "flex items-start justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2"
              }
            >
              <div>
                <p className="font-medium text-zinc-100">{item.title}</p>
                {item.description ? (
                  <p className="text-sm text-zinc-400">{item.description}</p>
                ) : null}
                {item.entityId ? (
                  <p className="text-xs text-zinc-500">
                    {entityName.get(item.entityId) ?? item.entityId}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
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
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen || openCreate} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit step" : "New checklist step"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-2">
                <Label htmlFor="formation-title">Title</Label>
                <Input
                  id="formation-title"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  required
                  className="border-zinc-700 bg-zinc-900"
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
                        status: e.target.value as FormationChecklistStatus,
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
                  <Label htmlFor="formation-order">Sort order</Label>
                  <Input
                    id="formation-order"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sortOrder: e.target.value }))
                    }
                    className="border-zinc-700 bg-zinc-900"
                  />
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
        title="Delete checklist step?"
        description={`Remove "${deleteTarget?.title}".`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteFormationChecklistItem(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </HoldingsSection>
  );
}
