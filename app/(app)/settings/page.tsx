"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog, EmptyState, SectionHeader } from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import {
  DataManagementSection,
  LAST_EXPORTED_AT_KEY,
} from "@/components/settings/data-management-section";
import { WorkspaceDataSourcesSection } from "@/components/settings/workspace-data-sources-section";
import { KeyboardShortcutsSection } from "@/components/settings/keyboard-shortcuts-section";
import { selectEntityOwnershipStats } from "@/components/settings/entity-ownership";
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
import { useOpenFromSearchParam } from "@/lib/hooks/use-open-from-search-param";
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
  const profile = useOctaneStore((state) => state.profile);
  const updateProfile = useOctaneStore((state) => state.updateProfile);
  const entities = useOctaneStore((state) => state.entities);
  const projects = useOctaneStore((state) => state.projects);
  const documents = useOctaneStore((state) => state.documents);
  const ipAssets = useOctaneStore((state) => state.ipAssets);
  const createEntity = useOctaneStore((state) => state.createEntity);
  const updateEntity = useOctaneStore((state) => state.updateEntity);
  const deleteEntity = useOctaneStore((state) => state.deleteEntity);

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
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LAST_EXPORTED_AT_KEY);
  });

  const ownershipByEntityId = useMemo(() => {
    const map = new Map<
      string,
      ReturnType<typeof selectEntityOwnershipStats>
    >();
    for (const entity of entities) {
      map.set(
        entity.id,
        selectEntityOwnershipStats(entity, projects, documents, ipAssets),
      );
    }
    return map;
  }, [documents, entities, ipAssets, projects]);

  const saveFounder = (event: React.FormEvent) => {
    event.preventDefault();
    updateProfile(founderForm);
    toast.success("Profile saved");
  };

  const openCreateEntity = () => {
    setEditingEntity(null);
    setEntityForm(emptyEntityForm);
    setEntityDialogOpen(true);
  };

  const openEntityFromUrl = useCallback(() => {
    setEditingEntity(null);
    setEntityForm(emptyEntityForm);
    setEntityDialogOpen(true);
  }, []);
  useOpenFromSearchParam("new", "entity", openEntityFromUrl);

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
      toast.success("Entity updated");
    } else {
      createEntity(payload);
      toast.success("Entity created");
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
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-zinc-700"
            render={<Link href="/holdings" />}
          >
            Open Holdings Command Center
          </Button>
        }
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

      <section className="space-y-4" data-testid="settings-ownership-map">
        <SectionHeader
          title="Ownership Map"
          description="Entity → linked projects, IP, documents, and compliance reminders."
          actions={
            <Button
              type="button"
              size="sm"
              data-testid="settings-add-entity"
              onClick={openCreateEntity}
            >
              <Plus className="size-4" />
              Add Entity
            </Button>
          }
        />
        {entities.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No legal entities yet"
            description="Track LLCs, trusts, and labs behind your projects. Add an entity to map ownership, documents, and compliance in one place."
            action={{
              label: "Add Entity",
              onClick: openCreateEntity,
            }}
          />
        ) : (
        <Card className="overflow-x-auto border-zinc-800/80 bg-zinc-900/30">
          <CardContent className="p-0">
            <table className={tableClass} data-testid="settings-ownership-table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Status</th>
                  <th>Projects</th>
                  <th>Docs</th>
                  <th>IP</th>
                  <th>Compliance</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((entity) => {
                  const stats = ownershipByEntityId.get(entity.id);
                  return (
                    <tr
                      key={entity.id}
                      data-testid={`settings-entity-row-${entity.id}`}
                    >
                      <td>
                        <div className="font-medium text-zinc-200">
                          {entity.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {formatStatusLabel(entity.type)}
                          {entity.jurisdiction
                            ? ` · ${entity.jurisdiction}`
                            : ""}
                        </div>
                      </td>
                      <td>
                        <Badge
                          variant="outline"
                          className="border-zinc-700 text-zinc-300"
                        >
                          {formatStatusLabel(entity.status)}
                        </Badge>
                      </td>
                      <td className="max-w-[12rem] text-zinc-300">
                        {stats && stats.linkedProjectNames.length > 0
                          ? stats.linkedProjectNames.join(", ")
                          : "—"}
                      </td>
                      <td className="tabular-nums text-zinc-300">
                        {stats?.docCount ?? 0}
                      </td>
                      <td className="tabular-nums text-zinc-300">
                        {stats?.ipCount ?? 0}
                      </td>
                      <td className="max-w-[14rem] text-xs text-amber-200/90">
                        {stats?.complianceHint ?? "—"}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            data-testid={`settings-edit-entity-${entity.id}`}
                            onClick={() => openEditEntity(entity)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-red-400"
                            data-testid={`settings-delete-entity-${entity.id}`}
                            onClick={() => setDeleteTarget(entity)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
        )}
      </section>

      <WorkspaceDataSourcesSection />

      <KeyboardShortcutsSection />

      <DataManagementSection
        lastExportedAt={lastExportedAt}
        onExported={setLastExportedAt}
      />

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
    </div>
  );
}
