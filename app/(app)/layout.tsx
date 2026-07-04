"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { WorkspaceModeBanner } from "@/components/layout/workspace-mode-banner";
import { getSupabaseClient } from "@/lib/supabase/client";
import { normalizeOctaneData } from "@/lib/data/normalize-octane-data";
import { useSignalIngest } from "@/lib/hooks/use-signal-ingest";
import { useSignalActionProposals } from "@/lib/hooks/use-signal-action-proposals";
import { loadFromSupabase, enableSyncDeletes } from "@/lib/supabase/sync";
import { mergeById } from "@/lib/supabase/merge";
import { useAutoSync } from "@/lib/hooks/use-auto-sync";
import { useCompanySync } from "@/lib/hooks/use-company-sync";
import { useConnectionReconcile } from "@/lib/hooks/use-connection-reconcile";
import { useOctaneStore } from "@/lib/store/octane-store";

function SignalIngestProvider({ children }: { children: React.ReactNode }) {
  useSignalIngest();
  // Watch derived + live signals and auto-propose approvable actions.
  useSignalActionProposals();
  return <>{children}</>;
}

function DataSyncProvider({ children }: { children: React.ReactNode }) {
  const syncedRef = useRef(false);
  const syncErrorToastShown = useRef(false);

  // Durable auto-save: push every change to Supabase (debounced; inert until a
  // real Supabase session exists). The load-on-mount below handles hydration.
  useAutoSync();
  // Same for the company context (the AI's brain) — separate store + table.
  useCompanySync();
  // Flip placeholder connection records to reality (GitHub/Vercel/Anthropic are
  // wired via env) so signals + the AI brief stop saying "not connected".
  useConnectionReconcile();

  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    async function syncOnMount() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // not logged in — middleware will redirect

        const result = await loadFromSupabase();
        if (!result.ok) {
          if (!syncErrorToastShown.current) {
            syncErrorToastShown.current = true;
            toast.error("Cloud sync unavailable", {
              description:
                "Using your local workspace. Check your connection or try again later.",
            });
          }
          return;
        }

        const synced = result.data;

        // Hydrate Zustand with Supabase data (normalized — safe for /projects etc.)
        const current = useOctaneStore.getState();
        // Non-destructive merge (union by id, newer updatedAt wins) so a sparse
        // or stale cloud never wipes local work.
        const normalized = normalizeOctaneData(
          {
            ...current,
            profile: synced.profile ?? current.profile,
            entities: mergeById(current.entities, synced.entities),
            projects: mergeById(current.projects, synced.projects),
            tasks: mergeById(current.tasks, synced.tasks),
            agents: mergeById(current.agents, synced.agents),
            transactions: mergeById(current.transactions, synced.transactions),
            decisions: mergeById(current.decisions, synced.decisions),
            documents: mergeById(current.documents, synced.documents),
            founderNotes: mergeById(current.founderNotes, synced.founderNotes),
            roadmapItems: mergeById(current.roadmapItems, synced.roadmapItems),
            inboxItems: mergeById(current.inboxItems, synced.inboxItems),
            connections: current.connections,
            octaneActions: current.octaneActions,
            projectConnections: current.projectConnections,
          },
          current.profile,
        );
        useOctaneStore.setState(normalized);
        // Cloud data is now merged into local — safe to let deletes propagate.
        enableSyncDeletes();
      } catch (err) {
        console.warn("[layout] Sync error (using local cache):", err);
        if (!syncErrorToastShown.current) {
          syncErrorToastShown.current = true;
          toast.error("Cloud sync unavailable", {
            description: "Using your local workspace until sync recovers.",
          });
        }
      }
    }

    void syncOnMount();
  }, []);

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataSyncProvider>
      <SignalIngestProvider>
      <div className="min-h-screen bg-transparent">
        <div className="flex items-center px-4 pt-3 md:hidden">
          <AppSidebar />
        </div>
        <div className="flex">
          <div className="hidden md:block">
            <AppSidebar />
          </div>
          <div className="flex min-h-screen flex-1 flex-col">
            <WorkspaceModeBanner />
            <AppTopbar />
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </div>
      </SignalIngestProvider>
    </DataSyncProvider>
  );
}
