"use client";

import { useEffect, useRef } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { getSupabaseClient } from "@/lib/supabase/client";
import { normalizeOctaneData } from "@/lib/data/normalize-octane-data";
import { loadFromSupabase } from "@/lib/supabase/sync";
import { useOctaneStore } from "@/lib/store/octane-store";

function DataSyncProvider({ children }: { children: React.ReactNode }) {
  const syncedRef = useRef(false);

  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    async function syncOnMount() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // not logged in — middleware will redirect

        const synced = await loadFromSupabase();
        if (!synced) return; // network error, use local cache

        // Hydrate Zustand with Supabase data (normalized — safe for /projects etc.)
        const current = useOctaneStore.getState();
        const normalized = normalizeOctaneData(
          {
            ...current,
            profile: synced.profile ?? current.profile,
            entities:
              synced.entities.length > 0 ? synced.entities : current.entities,
            projects:
              synced.projects.length > 0 ? synced.projects : current.projects,
            tasks: synced.tasks.length > 0 ? synced.tasks : current.tasks,
            agents: synced.agents.length > 0 ? synced.agents : current.agents,
            transactions:
              synced.transactions.length > 0
                ? synced.transactions
                : current.transactions,
            decisions:
              synced.decisions.length > 0 ? synced.decisions : current.decisions,
            documents:
              synced.documents.length > 0 ? synced.documents : current.documents,
            founderNotes:
              synced.founderNotes.length > 0
                ? synced.founderNotes
                : current.founderNotes,
            roadmapItems:
              synced.roadmapItems.length > 0
                ? synced.roadmapItems
                : current.roadmapItems,
            connections: current.connections,
            octaneActions: current.octaneActions,
            projectConnections: current.projectConnections,
          },
          current.profile,
        );
        useOctaneStore.setState(normalized);
      } catch (err) {
        console.warn("[layout] Sync error (using local cache):", err);
      }
    }

    void syncOnMount();
  }, []);

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataSyncProvider>
      <div className="min-h-screen bg-transparent">
        <div className="flex items-center px-4 pt-3 md:hidden">
          <AppSidebar />
        </div>
        <div className="flex">
          <div className="hidden md:block">
            <AppSidebar />
          </div>
          <div className="flex min-h-screen flex-1 flex-col">
            <AppTopbar />
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </div>
    </DataSyncProvider>
  );
}
