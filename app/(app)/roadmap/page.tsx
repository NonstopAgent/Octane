"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Map as MapIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import {
  ConfirmDialog,
  EmptyState,
  PriorityBadge,
  SectionHeader,
} from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { RoadmapFormDialog } from "@/components/modules/roadmap/roadmap-form-dialog";
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

export default function RoadmapPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <RoadmapPageContent />
    </Suspense>
  );
}

function RoadmapPageContent() {
  const searchParams = useSearchParams();
  const roadmapItems = useOctaneStore((state) => state.roadmapItems);
  const deleteRoadmapItem = useOctaneStore((state) => state.deleteRoadmapItem);
  const getProjectById = useOctaneStore((state) => state.getProjectById);

  const [view, setView] = useState<"board" | "timeline">("board");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<RoadmapItem | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<RoadmapItem | null>(null);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditItem(undefined);
      setFormOpen(true);
    }
  }, [searchParams]);

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
    setEditItem(undefined);
    setFormOpen(true);
  }

  function openEdit(item: RoadmapItem) {
    setEditItem(item);
    setFormOpen(true);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Roadmap"
        description="Strategic bets across time horizons."
        actions={
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              New item
            </Button>
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
          </div>
        }
      />

      {roadmapItems.length === 0 ? (
        <EmptyState
          icon={MapIcon}
          title="Roadmap is empty"
          description="Roadmap items connect strategic bets to projects and timelines. Add your first item to plan what ships now, next, and later."
          action={{ label: "New roadmap item", onClick: openCreate }}
        />
      ) : view === "board" ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {TIMEFRAMES.map((timeframe) => (
            <section key={timeframe} className="space-y-3">
              <SectionHeader
                title={timeframeLabels[timeframe]}
                description={`${itemsByTimeframe[timeframe].length} items`}
              />
              <div className="space-y-3">
                {itemsByTimeframe[timeframe].map((item) => {
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
                          <div className="flex gap-0.5">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => openEdit(item)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="text-red-400"
                              onClick={() => setDeleteTarget(item)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                        <PriorityBadge priority={item.priority} />
                        {project ? (
                          <p className="text-xs text-zinc-500">{project.name}</p>
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
                        {item.dependencies.length > 0 ? (
                          <p className="text-zinc-600">
                            Deps: {item.dependencies.join(", ")}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
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
            <TimelineQuarter
              key={quarter}
              quarter={quarter}
              items={items}
              getProjectById={getProjectById}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </section>
      )}

      <RoadmapFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editItem}
        onSaved={() => setEditItem(undefined)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete roadmap item?"
        description={`Remove "${deleteTarget?.title ?? "this item"}" from the roadmap.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteRoadmapItem(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function TimelineQuarter({
  quarter,
  items,
  getProjectById,
  onEdit,
  onDelete,
}: {
  quarter: string;
  items: RoadmapItem[];
  getProjectById: (id: string) => { name: string } | undefined;
  onEdit: (item: RoadmapItem) => void;
  onDelete: (item: RoadmapItem) => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-amber-400/90">{quarter}</h3>
      <div className="space-y-2 border-l-2 border-zinc-800 pl-4">
        {items.map((item) => {
          const project = item.projectId
            ? getProjectById(item.projectId)
            : undefined;
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-start justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-4 py-3",
              )}
            >
              <div>
                <TimelineItemHeader item={item} project={project} />
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => onEdit(item)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-red-400"
                  onClick={() => onDelete(item)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineItemHeader({
  item,
  project,
}: {
  item: RoadmapItem;
  project?: { name: string };
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-zinc-200">{item.title}</span>
        <Badge variant="outline" className="border-zinc-700 text-zinc-400">
          {timeframeLabels[item.timeframe]}
        </Badge>
        <PriorityBadge priority={item.priority} />
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {project?.name ?? "Portfolio"} ·{" "}
        {item.targetDate
          ? format(parseISO(item.targetDate), "MMM d, yyyy")
          : "No date"}
      </p>
    </>
  );
}
