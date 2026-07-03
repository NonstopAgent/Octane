"use client";

import { useState } from "react";
import { CloudDownload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useOctaneStore } from "@/lib/store/octane-store";

type Candidate = {
  name: string;
  framework: string | null;
  repo: string | null;
  prodUrl: string | null;
  updatedAt: string | null;
};

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Imports real Vercel projects as Octane projects with vercel + github
 * connections auto-linked. Skips projects that already exist (name match).
 */
export function ImportVercelButton() {
  const [loading, setLoading] = useState(false);
  const projects = useOctaneStore((s) => s.projects);
  const projectConnections = useOctaneStore((s) => s.projectConnections);
  const createProject = useOctaneStore((s) => s.createProject);
  const createProjectConnection = useOctaneStore((s) => s.createProjectConnection);

  async function handleImport() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/vercel/import-candidates");
      if (!res.ok) throw new Error(`Import fetch failed (${res.status})`);
      const data = (await res.json()) as {
        configured: boolean;
        candidates?: Candidate[];
      };
      if (!data.configured) {
        toast.error("Vercel not connected", {
          description: "Set VERCEL_TOKEN on the server to import projects.",
        });
        return;
      }

      const existingNames = new Set(projects.map((p) => normalize(p.name)));
      const existingVercelLabels = new Set(
        projectConnections
          .filter((c) => c.kind === "vercel")
          .map((c) => normalize(c.label ?? "")),
      );

      let imported = 0;
      for (const candidate of data.candidates ?? []) {
        const key = normalize(candidate.name);
        if (existingNames.has(key) || existingVercelLabels.has(key)) continue;
        // Also skip if an existing project name is contained in the vercel name
        // (e.g. project "Octane Nexus" ↔ vercel "octane-nexus-6em9").
        const shadowed = projects.some((p) => {
          const pk = normalize(p.name);
          return pk.length > 3 && (key.includes(pk) || pk.includes(key));
        });
        if (shadowed) continue;

        const project = createProject({
          name: candidate.name,
          description: candidate.repo
            ? `Imported from Vercel · repo ${candidate.repo}`
            : "Imported from Vercel",
          status: "launched",
          priority: "medium",
          owner: "Logan",
          progress: 100,
          revenueStatus: "pre_revenue",
        });
        createProjectConnection({
          projectId: project.id,
          kind: "vercel",
          label: candidate.name,
          url: candidate.prodUrl ?? undefined,
          status: "linked",
        });
        if (candidate.repo) {
          createProjectConnection({
            projectId: project.id,
            kind: "github",
            label: candidate.repo,
            repo: candidate.repo,
            url: `https://github.com/${candidate.repo}`,
            status: "linked",
          });
        }
        imported += 1;
      }

      if (imported > 0) {
        toast.success(`Imported ${imported} project(s) from Vercel`, {
          description: "Vercel + GitHub connections linked automatically.",
        });
      } else {
        toast.info("Nothing new to import", {
          description: "All Vercel projects already exist in Octane.",
        });
      }
    } catch (err) {
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleImport}
      disabled={loading}
    >
      <CloudDownload className="size-4" />
      {loading ? "Importing…" : "Import from Vercel"}
    </Button>
  );
}
