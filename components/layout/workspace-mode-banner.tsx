"use client";

import Link from "next/link";
import { Database, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { detectWorkspaceDataMode } from "@/lib/data/workspace-mode";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";

export function WorkspaceModeBanner() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));
  const [dismissed, setDismissed] = useState(false);

  const info = useMemo(() => detectWorkspaceDataMode(state), [state]);

  if (dismissed && info.mode === "demo_seed") {
    return null;
  }

  const tone =
    info.mode === "demo_seed"
      ? "border-amber-900/40 bg-amber-950/20 text-amber-100/90"
      : info.mode === "mixed"
        ? "border-sky-900/40 bg-sky-950/20 text-sky-100/90"
        : "border-emerald-900/30 bg-emerald-950/15 text-emerald-100/90";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs",
        tone,
      )}
      role="status"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Database className="mt-0.5 size-3.5 shrink-0 opacity-80" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium">
            Data mode · <span className="text-zinc-100">{info.label}</span>
          </p>
          <p className="mt-0.5 text-[11px] opacity-80">{info.description}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {info.mode === "demo_seed" ? (
          <Link
            href="/settings"
            className="rounded-md border border-amber-800/50 px-2 py-1 text-[11px] hover:bg-amber-950/40"
          >
            Reset demo in Settings
          </Link>
        ) : (
          <Link
            href="/settings"
            className="rounded-md border border-zinc-700/60 px-2 py-1 text-[11px] hover:bg-zinc-900/50"
          >
            Data & export
          </Link>
        )}
        {info.mode === "demo_seed" ? (
          <button
            type="button"
            className="rounded p-1 opacity-70 hover:opacity-100"
            aria-label="Dismiss demo banner"
            onClick={() => setDismissed(true)}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
