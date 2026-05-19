"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog, PriorityBadge, SectionHeader } from "@/components/modules";
import { RoadmapFormDialog } from "@/components/modules/roadmap/roadmap-form-dialog";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { RoadmapItem, RoadmapTimeframe } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIMEFRAMES: RoadmapTimeframe[] = ["now", "next", "later", "someday"];

const timeframeLabels: Record<RoadmapTimeframe, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  someday: "Someday",
};

function getQuarterLabel(targetDate?: string): string {
  if (!targetDate) return "Unscheduled";
  const date = parseISO(targetDate);
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  return `Q${quarter} ${date.getFullYear()}`;
}

function RoadmapPageContent() {
  const roadmapItems = useOctaneStore((state) => state.roadmapItems);
  const getProjectById = useOctaneStore((state) => state.getProjectById);
  const deleteRoadmapItem = useOctaneStore((state) => state.deleteRoadmapItem);
  const searchParams = useSearchParams();

  const [view, setView] = useState<"board" | "timeline">("board");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<RoadmapItem | null>(null);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditingItem(undefined);
      setFormOpen(true);
      return;
    }
    const detail = searchParams.get("detail");
    if (detail) {
      const item = roadmapItems.find((r) => r.id === detail);
      if (item) {
        setEditingItem(item);
        setFormOpen(true);
      }
    }
  }, [searchParams, roadmapItems]);

  const itemsByTimeframe = useMemo(() => {
    const grouped: Record<RoadmapTimeframe, RoadmapItem[]> = {
      now: [],
      next: [],
      later: [],
      someday: [],
    };
    for (const item of roadmapItems) {
      grouped[item.timeframe].push(item);
    }
    for (const key of TIMEFRAMES) {
      grouped[key].sort((a, b) => {
        if (a.targetDate && b.targetDate) {
          return a.targetDate.localeCompare(b.targetDate);
        }
        return a.title.localeCompare(b.title);
      });
    }
    return grouped;
  }, [roadmapItems]);

  const timelineByQuarter = useMemo(() => {
    const quarters = new Map<string, RoadmapItem[]>();
    for (const item of roadmapItems) {
      const label = getQuarterLabel(item.targetDate);
      const list = quarters.get(label) ?? [];
      list.push(item);
      quarters.set(label, list);
    }
    return [...quarters.entries()].sort(([a], [b]) => {
      if (a === "Unscheduled") return 1;
      if (b === "Unscheduled") return -1;
      return a.localeCompare(b);
    });
  }, [roadmapItems]);

  function openCreate() {
    setEditingItem(undefined);
    setFormOpen(true);
  }

  function openEdit(item: RoadmapItem) {
    setEditingItem(item);
    setFormOpen(true);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteRoadmapItem(deleteTarget.id);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Roadmap"
        description="Strategic bets across time horizons."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={view === "board" ? "default" : "outline"}
              className={view !== "board" ? "border-zinc-700" : undefined}
              onClick={() => setView("board")}
            >
              Board
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "timeline" ? "default" : "outline"}
              className={view !== "timeline" ? "border-zinc-700" : undefined}
              onClick={() => setView("timeline")}
            >
              Timeline
            </Button>
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              New Item
            </Button>
          </div>
        }
      />

      {view === "board" ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {TIMEFRAMES.map((timeframe) => (
            <section key={timeframe} className="space-y-3">
              <SectionHeader
                title={timeframeLabels[timeframe]}
                description={`${itemsByTimeframe[timeframe].length} items`}
              />
              <div className="space-y-3">
                {itemsByTimeframe[timeframe].length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-zinc-500">
                    No items
                  </p>
                ) : (
                  itemsByTimeframe[timeframe].map((item) => {
                    const project = item.projectId
                      ? getProjectById(item.projectId)
                      : undefined;
                    return (
                      <Card
                        key={item.id}
                        className="border-zinc-800/80 bg-zinc-900/40"
                      >
                        <CardHeader className="space-y-2 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-sm font-medium text-zinc-100">
                              {item.title}
                            </CardTitle>
                            <div className="flex shrink-0 items-center gap-1">
                              <PriorityBadge priority={item.priority} />
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="text-zinc-400 hover:text-zinc-100"
                                onClick={() => openEdit(item)}
                                aria-label={`Edit ${item.title}`}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="text-zinc-400 hover:text-red-300"
                                onClick={() => setDeleteTarget(item)}
                                aria-label={`Delete ${item.title}`}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                          {project ? (
                            <p className="text-xs text-zinc-500">
                              {project.name}
                            </p>
                          ) : null}
                        </CardHeader>
                        <CardContent className="space-y-2 pt-0 text-xs text-zinc-400">
                          <p className="line-clamp-2">{item.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant="outline"
                              className="border-zinc-700 text-zinc-400"
                            >
                              {formatStatusLabel(item.status)}
                            </Badge>
                            {item.targetDate ? (
                              <span>{item.targetDate}</span>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="space-y-6">
          <SectionHeader
            title="Quarterly Timeline"
            description="Roadmap items grouped by target quarter."
          />
          {timelineByQuarter.map(([quarter, items]) => (
            <div key={quarter} className="space-y-3">
              <h3 className="text-sm font-semibold text-amber-400/90">
                {quarter}
              </h3>
              <div className="space-y-2 border-l-2 border-zinc-800 pl-4">
                {items.map((item) => {
                  const project = item.projectId
                    ? getProjectById(item.projectId)
                    : undefined;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-4 py-3",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-200">
                          {item.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-zinc-700 text-zinc-400"
                        >
                          {timeframeLabels[item.timeframe]}
                        </Badge>
                        <PriorityBadge priority={item.priority} />
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="ml-auto text-zinc-400"
                          onClick={() => openEdit(item)}
                          aria-label={`Edit ${item.title}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-zinc-400 hover:text-red-300"
                          onClick={() => setDeleteTarget(item)}
                          aria-label={`Delete ${item.title}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {project?.name ?? "Portfolio"} ·{" "}
                        {item.targetDate
                          ? format(parseISO(item.targetDate), "MMM d, yyyy")
                          : "No date"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      <RoadmapFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editingItem}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete roadmap item?"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" will be removed from your roadmap.`
            : ""
        }
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function RoadmapPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <RoadmapPageContent />
    </Suspense>
  );
}
