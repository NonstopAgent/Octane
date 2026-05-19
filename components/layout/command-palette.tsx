"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  groupSearchResults,
  getSearchResultTypeLabel,
  searchCommandIndex,
  type CommandSearchResult,
  type SearchResultType,
} from "@/lib/search/command-search";
import { useOctaneStore } from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";

const GROUP_ORDER: SearchResultType[] = [
  "project",
  "task",
  "decision",
  "transaction",
  "document",
  "ipAsset",
  "roadmapItem",
  "agent",
  "entity",
];

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const state = useOctaneStore(
    useShallow((s) => ({
      projects: s.projects,
      tasks: s.tasks,
      agents: s.agents,
      transactions: s.transactions,
      documents: s.documents,
      ipAssets: s.ipAssets,
      decisions: s.decisions,
      roadmapItems: s.roadmapItems,
      entities: s.entities,
      profile: s.profile,
      activityLogs: s.activityLogs,
    })),
  );

  const results = useMemo(
    () => searchCommandIndex(state, query),
    [state, query],
  );
  const grouped = useMemo(() => groupSearchResults(results), [results]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const navigate = useCallback(
    (result: CommandSearchResult) => {
      onOpenChange(false);
      const url = result.detailParam
        ? `${result.href}?detail=${encodeURIComponent(result.detailParam)}`
        : result.href;
      router.push(url);
    },
    [onOpenChange, router],
  );

  const hasResults = GROUP_ORDER.some((type) => grouped[type].length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-zinc-100 sm:max-w-lg">
        <DialogHeader className="border-b border-zinc-800/80 px-4 py-3">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <DialogDescription className="sr-only">
            Search projects, tasks, and other records
          </DialogDescription>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects, tasks, decisions…"
              className="border-zinc-700 bg-zinc-900 pl-8"
              autoFocus
            />
          </div>
        </DialogHeader>
        <div className="max-h-[min(60vh,400px)] overflow-y-auto p-2">
          {!query.trim() ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">
              Type to search across your workspace
            </p>
          ) : !hasResults ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            GROUP_ORDER.map((type) => {
              const items = grouped[type];
              if (!items.length) return null;
              return (
                <section key={type} className="mb-2">
                  <p className="px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {getSearchResultTypeLabel(type)}
                  </p>
                  <ul>
                    {items.map((result) => (
                      <li key={`${result.type}-${result.id}`}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm",
                            "hover:bg-zinc-800/80 focus-visible:bg-zinc-800/80 focus-visible:outline-none",
                          )}
                          onClick={() => navigate(result)}
                        >
                          <span className="font-medium text-zinc-100">
                            {result.title}
                          </span>
                          <span className="line-clamp-1 text-xs text-zinc-500">
                            {result.description}
                            {result.projectName
                              ? ` · ${result.projectName}`
                              : null}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
