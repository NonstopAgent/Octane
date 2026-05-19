"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog, SectionHeader } from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
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
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Entity, EntityStatus, EntityType } from "@/lib/types";

const ENTITY_TYPES: EntityType[] = [
  "trust",
  "llc",
  "lab",
  "holding",
  "subsidiary",
  "other",
];

const ENTITY_STATUSES: EntityStatus[] = [
  "active",
  "forming",
  "inactive",
  "dissolved",
];

const tableClass =
  "w-full text-left text-sm [&_th]:border-b [&_th]:border-zinc-800 [&_th]:px-3 [&_th]:py-2 [&_th]:font-medium [&_th]:text-zinc-400 [&_td]:border-b [&_td]:border-zinc-800/60 [&_td]:px-3 [&_td]:py-2.5 [&_tr:last-child_td]:border-0";

const emptyEntityForm = {
  name: "",
  type: "llc" as EntityType,
  status: "active" as EntityStatus,
  formationDate: "",
  jurisdiction: "",
  notes: "",
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const profile = useOctaneStore((state) => state.profile);
  const updateProfile = useOctaneStore((state) => state.updateProfile);
  const entities = useOctaneStore((state) => state.entities);
  const projects = useOctaneStore((state) => state.projects);
  const documents = useOctaneStore((state) => state.documents);
  const ipAssets = useOctaneStore((state) => state.ipAssets);
  const createEntity = useOctaneStore((state) => state.createEntity);
  const updateEntity = useOctaneStore((state) => state.updateEntity);
  const deleteEntity = useOctaneStore((state) => state.deleteEntity);
  const resetToSeed = useOctaneStore((state) => state.resetToSeed);

  const [founderForm, setFounderForm] = useState({
    name: profile.name,
    role: profile.role,
    email: profile.email,
    timezone: profile.timezone,
  });
  const [company, setCompany] = useState({
    name: "Octane Labs LLC",
    tagline: "Founder command center for multi-project bets",
    website: "https://octane.dev",
    stage: "Pre-revenue / bootstrapped",
  });
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [entityForm, setEntityForm] = useState(emptyEntityForm);
  const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const ownershipRows = useMemo(() => {
    return entities.map((entity) => {
      const entityIp = ipAssets.filter((a) => a.ownerEntity === entity.id);
      const projectIds = new Set(
        entityIp
          .map((a) => a.projectId)
          .filter((id): id is string => Boolean(id)),
      );
      const projectNames = [...projectIds].map(
        (id) => projects.find((p) => p.id === id)?.name ?? id,
      );
      const entityDocs = documents.filter(
        (d) => d.projectId && projectIds.has(d.projectId),
      );
      const reminder =
        entity.status === "forming"
          ? "Formation in progress — confirm filing dates."
          : entity.formationDate
            ? "Annual compliance review recommended."
            : "Add formation date for compliance tracking.";
      return {
        entity,
        projectNames: [...new Set(projectNames)],
        docCount: entityDocs.length,
        ipCount: entityIp.length,
        reminder,
      };
    });
  }, [entities, projects, documents, ipAssets]);

  const saveFounder = (event: React.FormEvent) => {
    event.preventDefault();
    updateProfile(founderForm);
  };

  const openCreateEntity = () => {
    setEditingEntity(null);
    setEntityForm(emptyEntityForm);
    setEntityDialogOpen(true);
  };

  useEffect(() => {
    if (searchParams.get("new") === "entity") {
      openCreateEntity();
    }
  }, [searchParams]);

  const openEditEntity = (entity: Entity) => {
    setEditingEntity(entity);
    setEntityForm({
      name: entity.name,
      type: entity.type,
      status: entity.status,
      formationDate: entity.formationDate ?? "",
      jurisdiction: entity.jurisdiction ?? "",
      notes: entity.notes ?? "",
    });
    setEntityDialogOpen(true);
  };

  const saveEntity = (event: React.FormEvent) => {
    event.preventDefault();
    if (!entityForm.name.trim()) return;

    const payload = {
      name: entityForm.name.trim(),
      type: entityForm.type,
      status: entityForm.status,
      formationDate: entityForm.formationDate || undefined,
      jurisdiction: entityForm.jurisdiction || undefined,
      notes: entityForm.notes || undefined,
    };

    if (editingEntity) {
      updateEntity(editingEntity.id, payload);
    } else {
      createEntity(payload);
    }
    setEntityDialogOpen(false);
    setEditingEntity(null);
    setEntityForm(emptyEntityForm);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Founder profile, company details, and legal entities."
      />

      <section className="space-y-4">
        <SectionHeader title="Founder Profile" />
        <Card className="border-zinc-800/80 bg-zinc-900/30">
          <CardContent className="pt-4">
            <form onSubmit={saveFounder} className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="founder-name">Name</Label>
                <Input
                  id="founder-name"
                  value={founderForm.name}
                  onChange={(event) =>
                    setFounderForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="border-zinc-700 bg-zinc-900"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="founder-role">Role</Label>
                <Input
                  id="founder-role"
                  value={founderForm.role}
                  onChange={(event) =>
                    setFounderForm((prev) => ({
                      ...prev,
                      role: event.target.value,
                    }))
                  }
                  className="border-zinc-700 bg-zinc-900"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="founder-email">Email</Label>
                <Input
                  id="founder-email"
                  type="email"
                  value={founderForm.email}
                  onChange={(event) =>
                    setFounderForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  className="border-zinc-700 bg-zinc-900"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="founder-tz">Timezone</Label>
                <Input
                  id="founder-tz"
                  value={founderForm.timezone}
                  onChange={(event) =>
                    setFounderForm((prev) => ({
                      ...prev,
                      timezone: event.target.value,
                    }))
                  }
                  className="border-zinc-700 bg-zinc-900"
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Save Profile</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Company Profile"
          description="Local-only fields until Session 2 (not persisted)."
        />
        <Card className="border-zinc-800/80 bg-zinc-900/30">
          <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                value={company.name}
                onChange={(event) =>
                  setCompany((prev) => ({ ...prev, name: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company-stage">Stage</Label>
              <Input
                id="company-stage"
                value={company.stage}
                onChange={(event) =>
                  setCompany((prev) => ({ ...prev, stage: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="company-tagline">Tagline</Label>
              <Input
                id="company-tagline"
                value={company.tagline}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    tagline: event.target.value,
                  }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="company-website">Website</Label>
              <Input
                id="company-website"
                value={company.website}
                onChange={(event) =>
                  setCompany((prev) => ({
                    ...prev,
                    website: event.target.value,
                  }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Entity Tracker"
          description="Trusts, LLCs, and labs in the Octane structure."
          actions={
            <Button type="button" size="sm" onClick={openCreateEntity}>
              <Plus className="size-4" />
              Add Entity
            </Button>
          }
        />
        <Card className="border-zinc-800/80 bg-zinc-900/30 overflow-x-auto">
          <CardContent className="p-0">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Jurisdiction</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((entity) => (
                  <tr key={entity.id}>
                    <td className="font-medium text-zinc-200">{entity.name}</td>
                    <td>{formatStatusLabel(entity.type)}</td>
                    <td>{formatStatusLabel(entity.status)}</td>
                    <td className="text-zinc-400">
                      {entity.jurisdiction ?? "—"}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => openEditEntity(entity)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-red-400"
                          onClick={() => setDeleteTarget(entity)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <Dialog open={entityDialogOpen} onOpenChange={setEntityDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 ring-zinc-800/80 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEntity ? "Edit Entity" : "Add Entity"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Track legal entities across the Octane portfolio.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEntity} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="entity-name">Name</Label>
              <Input
                id="entity-name"
                required
                value={entityForm.name}
                onChange={(event) =>
                  setEntityForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="entity-type">Type</Label>
                <select
                  id="entity-type"
                  className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
                  value={entityForm.type}
                  onChange={(event) =>
                    setEntityForm((prev) => ({
                      ...prev,
                      type: event.target.value as EntityType,
                    }))
                  }
                >
                  {ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {formatStatusLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="entity-status">Status</Label>
                <select
                  id="entity-status"
                  className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm"
                  value={entityForm.status}
                  onChange={(event) =>
                    setEntityForm((prev) => ({
                      ...prev,
                      status: event.target.value as EntityStatus,
                    }))
                  }
                >
                  {ENTITY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="entity-jurisdiction">Jurisdiction</Label>
              <Input
                id="entity-jurisdiction"
                value={entityForm.jurisdiction}
                onChange={(event) =>
                  setEntityForm((prev) => ({
                    ...prev,
                    jurisdiction: event.target.value,
                  }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="entity-formed">Formation date</Label>
              <Input
                id="entity-formed"
                type="date"
                value={entityForm.formationDate}
                onChange={(event) =>
                  setEntityForm((prev) => ({
                    ...prev,
                    formationDate: event.target.value,
                  }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="entity-notes">Notes</Label>
              <Input
                id="entity-notes"
                value={entityForm.notes}
                onChange={(event) =>
                  setEntityForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <DialogFooter className="border-zinc-800/80 bg-zinc-900/40 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700"
                onClick={() => setEntityDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <section className="space-y-4">
        <SectionHeader
          title="Ownership Map"
          description="Entity → linked projects, IP, documents, and compliance reminders."
        />
        <Card className="border-zinc-800/80 bg-zinc-900/30 overflow-x-auto">
          <CardContent className="p-0">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Status</th>
                  <th>Linked projects</th>
                  <th>Docs / IP</th>
                  <th>Reminder</th>
                </tr>
              </thead>
              <tbody>
                {ownershipRows.map((row) => (
                  <tr key={row.entity.id}>
                    <td className="font-medium text-zinc-200">
                      {row.entity.name}
                    </td>
                    <td>{formatStatusLabel(row.entity.status)}</td>
                    <td className="text-zinc-400">
                      {row.projectNames.length
                        ? row.projectNames.join(", ")
                        : "—"}
                    </td>
                    <td className="text-zinc-400">
                      {row.docCount} / {row.ipCount}
                    </td>
                    <td className="text-xs text-amber-300/90">
                      {row.reminder}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Demo Data"
          description="Restore all modules to the seeded mock dataset."
        />
        <Card className="border-zinc-800/80 bg-zinc-900/30">
          <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-400">
              Clears local changes and reloads projects, tasks, finance, and
              other seed records from the store.
            </p>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-red-800/80 text-red-300 hover:bg-red-950/30"
              onClick={() => setResetOpen(true)}
            >
              Reset Demo Data
            </Button>
          </CardContent>
        </Card>
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete entity?"
        description={`Remove ${deleteTarget?.name ?? "this entity"} from the tracker.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteEntity(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset demo data?"
        description="This replaces all local data with the original seed dataset. Your profile and entity changes will be lost."
        confirmLabel="Reset"
        onConfirm={() => {
          resetToSeed();
          const seededProfile = useOctaneStore.getState().profile;
          setFounderForm({
            name: seededProfile.name,
            role: seededProfile.role,
            email: seededProfile.email,
            timezone: seededProfile.timezone,
          });
          setResetOpen(false);
        }}
      />
    </div>
  );
}
