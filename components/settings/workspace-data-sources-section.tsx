"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { SectionHeader } from "@/components/modules";
import { Card, CardContent } from "@/components/ui/card";
import { detectWorkspaceDataMode } from "@/lib/data/workspace-mode";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";

export function WorkspaceDataSourcesSection() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));
  const connections = useOctaneStore((s) => s.connections);
  const info = useMemo(() => detectWorkspaceDataMode(state), [state]);

  const github = connections.find((c) => c.provider === "github");
  const vercel = connections.find((c) => c.provider === "vercel");

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Workspace data sources"
        description="What is demo seed vs linked live vs server-only."
      />
      <Card className="border-zinc-800/80 bg-zinc-900/30">
        <CardContent className="space-y-4 pt-4 text-sm text-zinc-300">
          <p>
            <span className="text-zinc-500">Data mode · </span>
            <span
              className={cn(
                "font-medium",
                info.mode === "demo_seed"
                  ? "text-amber-300"
                  : info.mode === "mixed"
                    ? "text-sky-300"
                    : "text-emerald-300",
              )}
            >
              {info.label}
            </span>
          </p>
          <ul className="space-y-2 text-xs text-zinc-400">
            <li>
              · <strong className="text-zinc-300">Portfolio</strong> — projects, tasks, finance in
              browser storage (and optional Supabase sync).{" "}
              {info.seedPortfolio
                ? "Currently matches demo seed IDs."
                : "Customized beyond demo seed."}
            </li>
            <li>
              · <strong className="text-zinc-300">GitHub / Vercel</strong> — live when server tokens
              are set and you link repos/projects on{" "}
              <Link href="/connections" className="text-amber-400/90 hover:underline">
                Connections
              </Link>
              . Status: GitHub {github?.status ?? "—"}, Vercel {vercel?.status ?? "—"}.
            </li>
            <li>
              · <strong className="text-zinc-300">User-entered</strong> — profile, entities, founder
              notes, and links you add manually.
            </li>
            <li>
              · <strong className="text-zinc-300">Reset demo</strong> — use Data management below to
              restore bundled seed data (does not change server env tokens).
            </li>
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
