"use client";

import { useMemo, useState } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";

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
import { hasIpOwnershipGap } from "@/lib/holdings/metrics";
import { useOctaneStore } from "@/lib/store/octane-store";
import type {
  IPAsset,
  IPAssetType,
  IPProtectionStatus,
} from "@/lib/types";

import { HoldingsSection } from "./holdings-section";

const IP_TYPES: IPAssetType[] = [
  "software",
  "brand",
  "domain",
  "content",
  "dataset",
  "strategy",
  "document",
];

const PROTECTION: IPProtectionStatus[] = [
  "unprotected",
  "in_progress",
  "registered",
  "licensed",
];

const tableClass =
  "w-full text-left text-sm [&_th]:border-b [&_th]:border-zinc-800 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:text-zinc-400 [&_td]:border-b [&_td]:border-zinc-800/60 [&_td]:px-3 [&_td]:py-2.5 [&_tr:last-child_td]:border-0";

type AssetOwnershipSectionProps = {
  openCreate?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  detailId?: string | null;
};

export function AssetOwnershipSection({
  openCreate = false,
  onCreateOpenChange,
  detailId,
}: AssetOwnershipSectionProps) {
  const ipAssets = useOctaneStore((s) => s.ipAssets);
  const entities = useOctaneStore((s) => s.entities);
  const projects = useOctaneStore((s) => s.projects);
  const createIPAsset = useOctaneStore((s) => s.createIPAsset);
  const updateIPAsset = useOctaneStore((s) => s.updateIPAsset);
  const deleteIPAsset = useOctaneStore((s) => s.deleteIPAsset);

  const [dialogOpen, setDialogOpen] = useState(openCreate);
  const [editing, setEditing] = useState<IPAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IPAsset | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "software" as IPAssetType,
    ownerEntity: entities[0]?.id ?? "",
    intendedOwnerEntity: "",
    projectId: "",
    protectionStatus: "unprotected" as IPProtectionStatus,
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

  const sortedAssets = useMemo(
    () =>
      [...ipAssets].sort((a, b) => a.name.localeCompare(b.name)),
    [ipAssets],
  );

  const openDialog = (asset?: IPAsset) => {
    if (asset) {
      setEditing(asset);
      setForm({
        name: asset.name,
        type: asset.type,
        ownerEntity: asset.ownerEntity,
        intendedOwnerEntity: asset.intendedOwnerEntity ?? "",
        projectId: asset.projectId ?? "",
        protectionStatus: asset.protectionStatus,
        notes: asset.notes ?? "",
      });
    } else {
      setEditing(null);
      setForm({
        name: "",
        type: "software",
        ownerEntity: entities[0]?.id ?? "",
        intendedOwnerEntity: "",
        projectId: "",
        protectionStatus: "unprotected",
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
    if (!form.name.trim() || !form.ownerEntity) return;
    const payload = {
      name: form.name.trim(),
      type: form.type,
      ownerEntity: form.ownerEntity,
      intendedOwnerEntity: form.intendedOwnerEntity || undefined,
      projectId: form.projectId || undefined,
      protectionStatus: form.protectionStatus,
      notes: form.notes || undefined,
    };
    if (editing) {
      updateIPAsset(editing.id, payload);
    } else {
      createIPAsset(payload);
    }
    closeDialog();
  };

  const highlighted = detailId
    ? sortedAssets.find((a) => a.id === detailId)
    : undefined;

  return (
    <HoldingsSection
      id="asset-ownership"
      title="Asset ownership tracker"
      description="IP assets, current vs intended owner, and gap status."
      icon={Layers}
    >
      <div className="mb-3 flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => openDialog()}>
          <Plus className="size-3.5" />
          Add IP asset
        </Button>
      </div>

      {sortedAssets.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No IP assets"
          description="Track software, brand, domains, and other IP with ownership targets."
          action={{ label: "Add IP asset", onClick: () => openDialog() }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800/80">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Intended</th>
                <th>Gap</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedAssets.map((asset) => (
                <tr
                  key={asset.id}
                  className={
                    highlighted?.id === asset.id
                      ? "bg-amber-500/10"
                      : undefined
                  }
                >
                  <td className="font-medium text-zinc-100">{asset.name}</td>
                  <td>{formatStatusLabel(asset.type)}</td>
                  <td>{entityName.get(asset.ownerEntity) ?? asset.ownerEntity}</td>
                  <td>
                    {asset.intendedOwnerEntity
                      ? entityName.get(asset.intendedOwnerEntity) ??
                        asset.intendedOwnerEntity
                      : "—"}
                  </td>
                  <td>
                    {hasIpOwnershipGap(asset) ? (
                      <Badge className="bg-amber-500/20 text-amber-200">
                        Gap
                      </Badge>
                    ) : (
                      <span className="text-zinc-500">OK</span>
                    )}
                  </td>
                  <td className="text-right">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => openDialog(asset)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-red-300"
                      onClick={() => setDeleteTarget(asset)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen || openCreate} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit IP asset" : "New IP asset"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-2">
                <Label htmlFor="ip-name">Name</Label>
                <Input
                  id="ip-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="border-zinc-700 bg-zinc-900"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ip-type">Type</Label>
                  <select
                    id="ip-type"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        type: e.target.value as IPAssetType,
                      }))
                    }
                  >
                    {IP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {formatStatusLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ip-protection">Protection</Label>
                  <select
                    id="ip-protection"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    value={form.protectionStatus}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        protectionStatus: e.target.value as IPProtectionStatus,
                      }))
                    }
                  >
                    {PROTECTION.map((p) => (
                      <option key={p} value={p}>
                        {formatStatusLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ip-owner">Current owner entity</Label>
                <select
                  id="ip-owner"
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  value={form.ownerEntity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ownerEntity: e.target.value }))
                  }
                  required
                >
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ip-intended">Intended owner (optional)</Label>
                <select
                  id="ip-intended"
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                  value={form.intendedOwnerEntity}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      intendedOwnerEntity: e.target.value,
                    }))
                  }
                >
                  <option value="">Same as current</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ip-project">Project (optional)</Label>
                <select
                  id="ip-project"
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
        title="Delete IP asset?"
        description={`Remove "${deleteTarget?.name}" from the tracker.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteIPAsset(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </HoldingsSection>
  );
}
