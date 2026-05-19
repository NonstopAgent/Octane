"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { getSupabaseClient } from "@/lib/supabase/client";
import { loadFromSupabase } from "@/lib/supabase/sync";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { OctanePersistedState } from "@/lib/store/octane-store";

function DataSyncProvider({ children }: { children: React.ReactNode }) {
  const syncedRef = useRef(false);
  const router = useRouter();

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

        if (synced.isEmpty) {
          // New user — redirect to setup (unless already there)
          if (!window.location.pathname.startsWith("/setup")) {
            router.replace("/setup");
          }
          return;
        }

        // Hydrate Zustand store with Supabase data (server is source of truth)
        const patch: Partial<OctanePersistedState> = {};
        if (synced.profile) patch.profile = synced.profile;
        if (synced.entities.length > 0) patch.entities = synced.entities;
        if (synced.projects.length > 0) patch.projects = synced.projects;
        if (synced.tasks.length > 0) patch.tasks = synced.tasks;
        if (synced.agents.length > 0) patch.agents = synced.agents;
        if (synced.transactions.length > 0) patch.transactions = synced.transactions;
        if (synced.decisions.length > 0) patch.decisions = synced.decisions;
        if (synced.documents.length > 0) patch.documents = synced.documents;
        if (synced.founderNotes.length > 0) patch.founderNotes = synced.founderNotes;
        if (synced.roadmapItems.length > 0) patch.roadmapItems = synced.roadmapItems;

        if (Object.keys(patch).length > 0) {
          useOctaneStore.setState(patch);
        }
      } catch (err) {
        console.warn("[layout] Sync error (using local cache):", err);
      }
    }

    void syncOnMount();
  }, [router]);

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
