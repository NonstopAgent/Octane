"use client";

import { useCallback, useRef, useState } from "react";
import { format } from "date-fns";
import { Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog, SectionHeader } from "@/components/modules";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { importSnapshotData as validateSnapshot } from "@/lib/data/snapshot";
import type { OctaneSnapshot } from "@/lib/data/snapshot";
import { useOctaneStore } from "@/lib/store/octane-store";
import { appVersion, dataSchemaVersion } from "@/lib/version";

export const LAST_EXPORTED_AT_KEY = "octane-core-last-exported-at";

type DataManagementSectionProps = {
  lastExportedAt: string | null;
  lastSupabaseSyncAt: string | null;
  onExported: (iso: string) => void;
};

export function DataManagementSection({
  lastExportedAt,
  lastSupabaseSyncAt,
  onExported,
}: DataManagementSectionProps) {
  const exportSnapshotData = useOctaneStore((state) => state.exportSnapshotData);
  const importSnapshotData = useOctaneStore((state) => state.importSnapshotData);
  const clearLocalData = useOctaneStore((state) => state.clearLocalData);
  const resetToSeed = useOctaneStore((state) => state.resetToSeed);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<OctaneSnapshot | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const handleExport = useCallback(() => {
    try {
      const snapshot = exportSnapshotData();
      const dateLabel = format(new Date(), "yyyy-MM-dd");
      const filename = `octane-core-snapshot-${dateLabel}.json`;
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      localStorage.setItem(LAST_EXPORTED_AT_KEY, snapshot.generatedAt);
      onExported(snapshot.generatedAt);
      toast.success("Snapshot exported", {
        description: filename,
      });
    } catch {
      toast.error("Export failed", {
        description: "Could not build snapshot from local data.",
      });
    }
  }, [exportSnapshotData, onExported]);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);
        const snapshot = validateSnapshot(parsed);
        setPendingImport(snapshot);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid snapshot file.";
        toast.error("Import failed", { description: message });
      }
    },
    [],
  );

  const confirmImport = useCallback(() => {
    if (!pendingImport) return;
    try {
      importSnapshotData(pendingImport);
      toast.success("Snapshot imported", {
        description: `${pendingImport.projects.length} projects, ${pendingImport.entities.length} entities loaded.`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not apply snapshot.";
      toast.error("Import failed", { description: message });
    } finally {
      setPendingImport(null);
    }
  }, [importSnapshotData, pendingImport]);

  const importSummary = pendingImport
    ? `${pendingImport.projects.length} projects · ${pendingImport.tasks.length} tasks · ${pendingImport.entities.length} entities`
    : "";

  return (
    <section className="space-y-4" data-testid="settings-data-management">
      <SectionHeader
        title="Data Management"
        description="Export, import, or reset local Octane data (browser only)."
      />
      <Card className="border-zinc-800/80 bg-zinc-900/30">
        <CardContent className="space-y-4 pt-4">
          <p
            className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100/90"
            data-testid="settings-data-safety-warning"
          >
            Octane Core is currently local-first. Your data is stored in this
            browser unless exported. Use Export JSON regularly until Supabase
            sync is added.
          </p>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem
              label="App version"
              value={appVersion}
              testId="settings-app-version"
            />
            <MetaItem
              label="Data schema"
              value={dataSchemaVersion}
              testId="settings-data-schema-version"
            />
            <MetaItem
              label="Last export"
              value={
                lastExportedAt
                  ? format(new Date(lastExportedAt), "MMM d, yyyy · h:mm a")
                  : "Never"
              }
              testId="settings-last-exported-at"
            />
            <MetaItem
              label="Last Supabase sync"
              value={
                lastSupabaseSyncAt
                  ? format(new Date(lastSupabaseSyncAt), "MMM d, yyyy · h:mm a")
                  : "Never"
              }
              testId="settings-last-supabase-sync-at"
            />
          </div>

          <div className="flex flex-wrap gap-2" data-testid="settings-data-actions">
            <Button
              type="button"
              size="sm"
              data-testid="settings-export-snapshot"
              onClick={handleExport}
            >
              <Download className="size-4" />
              Export JSON
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-zinc-700"
              data-testid="settings-import-snapshot"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Import JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              data-testid="settings-import-file-input"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-zinc-700 text-red-300 hover:text-red-200"
              data-testid="settings-clear-local-data"
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="size-4" />
              Clear local data
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-zinc-700"
              data-testid="settings-reset-demo-data"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw className="size-4" />
              Reset demo data
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingImport)}
        onOpenChange={(open) => !open && setPendingImport(null)}
        title="Import snapshot?"
        description={`Replace all local data with this snapshot? ${importSummary}`}
        confirmLabel="Import"
        onConfirm={confirmImport}
      />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear local data?"
        description="Remove persisted data and reload the seed dataset. This cannot be undone."
        confirmLabel="Clear"
        onConfirm={() => {
          clearLocalData();
          setClearOpen(false);
          toast.success("Local data cleared");
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset demo data?"
        description="Restore the bundled seed dataset and clear activity history."
        confirmLabel="Reset"
        onConfirm={() => {
          resetToSeed();
          setResetOpen(false);
          toast.success("Demo data restored");
        }}
      />
    </section>
  );
}

function MetaItem({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <p className="text-zinc-500">{label}</p>
      <p className="font-medium text-zinc-200">{value}</p>
    </div>
  );
}
