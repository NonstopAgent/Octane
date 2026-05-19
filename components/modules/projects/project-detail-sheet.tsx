"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { PriorityBadge, StatusBadge } from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/dashboard/metrics";
import { computeProjectHealth } from "@/lib/scoring/project-health";
import { useOctaneStore } from "@/lib/store/octane-store";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ProjectForm } from "./project-form";
import { formatRevenueStatus, formatUpdatedAt } from "./project-utils";

type ProjectDetailSheetProps = {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditRequest?: () => void;
};

const TABS = [
  "overview",
  "tasks",
  "finance",
  "documents",
  "decisions",
  "roadmap",
  "risks",
  "nextActions",
] as const;

type TabId = (typeof TABS)[number];

const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview",
  tasks: "Tasks",
  finance: "Finance",
  documents: "Documents/IP",
  decisions: "Decisions",
  roadmap: "Roadmap",
  risks: "Risks",
  nextActions: "Next Actions",
};

function BulletList({
  title,
  items,
}: {
  title: string;
  items?: string[];
}) {
  if (!items?.length) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <ul className="list-inside list-disc space-y-1 text-sm text-zinc-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function RecordList({
  empty,
  count,
  children,
}: {
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  return <ul className="space-y-2">{children}</ul>;
}

export function ProjectDetailSheet({
  projectId,
  open,
  onOpenChange,
  onEditRequest,
}: ProjectDetailSheetProps) {
  const storeSlice = useOctaneStore(
    useShallow((s) => ({
      projects: s.projects,
      tasks: s.tasks,
      transactions: s.transactions,
      documents: s.documents,
      ipAssets: s.ipAssets,
      decisions: s.decisions,
      roadmapItems: s.roadmapItems,
    })),
  );

  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");

  const project = useMemo(
    () =>
      projectId
        ? storeSlice.projects.find((p) => p.id === projectId)
        : undefined,
    [storeSlice.projects, projectId],
  );

  const health = useMemo(() => {
    if (!project) return null;
    return computeProjectHealth(project, storeSlice);
  }, [project, storeSlice]);

  const linked = useMemo(() => {
    if (!projectId) {
      return {
        tasks: [],
        transactions: [],
        documents: [],
        ipAssets: [],
        decisions: [],
        roadmapItems: [],
      };
    }
    return {
      tasks: storeSlice.tasks.filter((t) => t.projectId === projectId),
      transactions: storeSlice.transactions.filter(
        (t) => t.projectId === projectId,
      ),
      documents: storeSlice.documents.filter((d) => d.projectId === projectId),
      ipAssets: storeSlice.ipAssets.filter((a) => a.projectId === projectId),
      decisions: storeSlice.decisions.filter((d) => d.projectId === projectId),
      roadmapItems: storeSlice.roadmapItems.filter(
        (r) => r.projectId === projectId,
      ),
    };
  }, [projectId, storeSlice]);

  if (!project) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Project</SheetTitle>
            <SheetDescription>Project not found.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEditing(false);
          setTab("overview");
        }
        onOpenChange(next);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-zinc-800/80 pb-4">
          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="space-y-1">
              <SheetTitle>{project.name}</SheetTitle>
              <SheetDescription>{project.description}</SheetDescription>
              <ProjectBadges project={project} />
            </div>
          </div>
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 w-fit"
              onClick={() => {
                setEditing(true);
                onEditRequest?.();
              }}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          ) : null}
        </SheetHeader>

        {editing ? (
          <div className="p-4 pt-0">
            <ProjectForm
              project={project}
              onCancel={() => setEditing(false)}
              onSuccess={() => setEditing(false)}
            />
          </div>
        ) : (
          <div className="space-y-4 p-4 pt-0">
            {health ? (
              <section className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
                <HealthHeader health={health} />
                <p className="mt-2 text-xs text-zinc-500">
                  {health.recentActivitySummary}
                </p>
                <p className="mt-2 text-sm text-amber-200/90">
                  {health.nextRecommendedAction}
                </p>
              </section>
            ) : null}

            <TabNav tab={tab} onTabChange={setTab} />

            <TabPanel
              tab={tab}
              project={project}
              linked={linked}
              health={health}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProjectBadges({ project }: { project: Project }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge domain="project" status={project.status} />
      <PriorityBadge priority={project.priority} />
    </div>
  );
}

function HealthHeader({
  health,
}: {
  health: NonNullable<ReturnType<typeof computeProjectHealth>>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-medium text-zinc-200">Project health</p>
      <Badge
        variant="outline"
        className={cn(
          "tabular-nums",
          health.score >= 70
            ? "border-emerald-800 text-emerald-300"
            : health.score >= 40
              ? "border-amber-800 text-amber-300"
              : "border-red-800 text-red-300",
        )}
      >
        {health.score}/100
      </Badge>
    </div>
  );
}

function TabNav({
  tab,
  onTabChange,
}: {
  tab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-zinc-800/80 pb-2">
      {TABS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
            tab === id
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          {TAB_LABELS[id]}
        </button>
      ))}
    </div>
  );
}

function TabPanel({
  tab,
  project,
  linked,
  health,
}: {
  tab: TabId;
  project: Project;
  linked: {
    tasks: ReturnType<typeof useOctaneStore.getState>["tasks"];
    transactions: ReturnType<typeof useOctaneStore.getState>["transactions"];
    documents: ReturnType<typeof useOctaneStore.getState>["documents"];
    ipAssets: ReturnType<typeof useOctaneStore.getState>["ipAssets"];
    decisions: ReturnType<typeof useOctaneStore.getState>["decisions"];
    roadmapItems: ReturnType<typeof useOctaneStore.getState>["roadmapItems"];
  };
  health: ReturnType<typeof computeProjectHealth> | null;
}) {
  if (tab === "overview") {
    return (
      <div className="space-y-6">
        <section className="space-y-2">
          <div className="grid gap-2 text-sm text-zinc-300">
            <p>
              <span className="text-zinc-500">Owner · </span>
              {project.owner}
            </p>
            <p>
              <span className="text-zinc-500">Revenue · </span>
              {formatRevenueStatus(project.revenueStatus)}
            </p>
            <p>
              <span className="text-zinc-500">Updated · </span>
              {formatUpdatedAt(project.updatedAt)}
            </p>
            {health ? (
              <p>
                <span className="text-zinc-500">Open tasks · </span>
                {health.openTasksCount} · blockers {health.blockersCount}
              </p>
            ) : null}
          </div>
          <Progress value={project.progress} />
        </section>
        {project.currentPhase ? (
          <section className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Phase
            </h3>
            <p className="text-sm text-zinc-300">{project.currentPhase}</p>
          </section>
        ) : null}
        <BulletList title="Goals" items={project.goals} />
        {project.revenueNotes ? (
          <section className="space-y-1">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Revenue notes
            </h3>
            <p className="text-sm text-zinc-300">{project.revenueNotes}</p>
          </section>
        ) : null}
      </div>
    );
  }

  if (tab === "tasks") {
    const sorted = [...linked.tasks].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    return (
      <RecordList empty="No tasks for this project." count={sorted.length}>
        {sorted.map((task) => (
          <li
            key={task.id}
            className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-zinc-200">{task.title}</span>
              <StatusBadge domain="task" status={task.status} />
            </div>
          </li>
        ))}
      </RecordList>
    );
  }

  if (tab === "finance") {
    const net = linked.transactions.reduce((sum, t) => sum + t.amount, 0);
    return (
      <FinanceTab transactions={linked.transactions} net={net} />
    );
  }

  if (tab === "documents") {
    return (
      <div className="space-y-4">
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase text-zinc-500">
            Documents
          </h3>
          <RecordList empty="No documents linked." count={linked.documents.length}>
            {linked.documents.map((doc) => (
              <li
                key={doc.id}
                className="rounded-lg border border-zinc-800/80 px-3 py-2 text-sm text-zinc-300"
              >
                {doc.name}
              </li>
            ))}
          </RecordList>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase text-zinc-500">
            IP assets
          </h3>
          <RecordList empty="No IP assets linked." count={linked.ipAssets.length}>
            {linked.ipAssets.map((asset) => (
              <li
                key={asset.id}
                className="rounded-lg border border-zinc-800/80 px-3 py-2 text-sm text-zinc-300"
              >
                {asset.name} · {formatStatusLabel(asset.type)}
              </li>
            ))}
          </RecordList>
        </section>
      </div>
    );
  }

  if (tab === "decisions") {
    return (
      <RecordList
        empty="No decisions linked. Log one to capture strategic calls."
        count={linked.decisions.length}
      >
        {linked.decisions.map((d) => (
          <li
            key={d.id}
            className="rounded-lg border border-zinc-800/80 px-3 py-2 text-sm"
          >
            <p className="font-medium text-zinc-200">{d.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
              {d.summary}
            </p>
          </li>
        ))}
      </RecordList>
    );
  }

  if (tab === "roadmap") {
    return (
      <RecordList empty="No roadmap items for this project." count={linked.roadmapItems.length}>
        {linked.roadmapItems.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-zinc-800/80 px-3 py-2 text-sm text-zinc-300"
          >
            {item.title} · {formatStatusLabel(item.status)}
          </li>
        ))}
      </RecordList>
    );
  }

  if (tab === "risks") {
    return <BulletList title="Risks" items={project.risks} />;
  }

  return <BulletList title="Next actions" items={project.nextActions} />;
}

function FinanceTab({
  transactions,
  net,
}: {
  transactions: ReturnType<typeof useOctaneStore.getState>["transactions"];
  net: number;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        Net:{" "}
        <span className="font-medium text-zinc-200">
          {formatCurrency(net)}
        </span>
      </p>
      <RecordList empty="No transactions for this project." count={transactions.length}>
        {transactions.map((txn) => (
          <li
            key={txn.id}
            className="flex justify-between rounded-lg border border-zinc-800/80 px-3 py-2 text-sm"
          >
            <span className="text-zinc-300">
              {formatStatusLabel(txn.type)} · {txn.category}
            </span>
            <span className="tabular-nums text-zinc-200">
              {formatCurrency(txn.amount)}
            </span>
          </li>
        ))}
      </RecordList>
    </div>
  );
}
