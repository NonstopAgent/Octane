"use client";

import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ListTodo,
  Plus,
  Scale,
  Sparkles,
  StickyNote,
  Timer,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, StatusBadge } from "@/components/modules";
import { AddNoteDialog } from "@/components/modules/today/add-note-dialog";
import { TodayTaskRow } from "@/components/modules/today/task-row";
import { TodaySection } from "@/components/modules/today/today-section";
import { WorkSessionPanel } from "@/components/modules/today/work-session-panel";
import { Button } from "@/components/ui/button";
import { useOpenFromSearchParam } from "@/lib/hooks/use-open-from-search-param";
import {
  buildDisplaySignals,
  selectActiveSignals,
  selectWorkspaceForSignals,
} from "@/lib/signals/workspace-signals";
import {
  useOctaneStore,
  type OctaneStore,
} from "@/lib/store/octane-store";
import { generateTodayView } from "@/lib/today/generate-today-view";

// Targeted selector — only subscribe to fields generateTodayView needs.
// Avoids re-renders from unrelated state changes (e.g. signals updates).
function selectTodayState(s: OctaneStore) {
  return {
    profile: s.profile,
    projects: s.projects,
    tasks: s.tasks,
    decisions: s.decisions,
    roadmapItems: s.roadmapItems,
    transactions: s.transactions,
    documents: s.documents,
    ipAssets: s.ipAssets,
    entities: s.entities,
    agents: s.agents,
    activityLogs: s.activityLogs,
    workSessions: s.workSessions,
    inboxItems: s.inboxItems,
    founderNotes: s.founderNotes,
    complianceReminders: s.complianceReminders,
    legalQuestions: s.legalQuestions,
    formationChecklistItems: s.formationChecklistItems,
    agentLogs: s.agentLogs,
    agentRuns: s.agentRuns,
    connections: s.connections,
    octaneActions: s.octaneActions,
    projectConnections: s.projectConnections,
    codingJobs: s.codingJobs,
  };
}

export function TodayView() {
  const state = useOctaneStore(useShallow(selectTodayState));
  const workspace = useOctaneStore(useShallow(selectWorkspaceForSignals));
  const storedSignals = useOctaneStore((s) => s.signals);
  const [showStartSession, setShowStartSession] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const today = useMemo(
    () => generateTodayView({ ...state, signals: storedSignals }),
    [state, storedSignals],
  );

  const activeSignals = useMemo(
    () =>
      selectActiveSignals(buildDisplaySignals(workspace, storedSignals))
        .filter((s) => s.severity === "critical" || s.severity === "high")
        .slice(0, 4),
    [workspace, storedSignals],
  );

  const openSession = useCallback(() => setShowStartSession(true), []);
  useOpenFromSearchParam("session", "1", openSession);

  if (state.projects.length === 0 && state.tasks.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Today"
          description="Real-time execution — work session, due work, and blockers."
        />
        <EmptyState
          icon={ListTodo}
          title="Today is wide open"
          description="Today surfaces due work, blockers, and top moves. Create a project and add tasks to see your operating view."
          action={{
            label: "New task",
            onClick: () => {
              window.location.assign("/tasks?new=1");
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Today"
        description={`Execution dashboard · ${format(new Date(today.generatedAt), "EEEE, MMM d")}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setShowStartSession(true)}>
              <Timer className="size-4" aria-hidden />
              Start session
            </Button>
            <Link
              href="/tasks?new=1"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              <Plus className="size-4" aria-hidden />
              New task
            </Link>
            <Link
              href="/decisions?new=1"
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              <Scale className="size-4" aria-hidden />
              New decision
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNoteOpen(true)}
            >
              <StickyNote className="size-4" aria-hidden />
              Add note
            </Button>
          </div>
        }
      />

      <WorkSessionPanel
        showStartForm={showStartSession}
        onShowStartFormChange={setShowStartSession}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <TaskListSection
          title="Due today"
          description="Open tasks due on the calendar day"
          icon={ListTodo}
          emptyTitle="Nothing due today"
          emptyDescription="No open tasks are scheduled for today."
          items={today.dueToday}
        />

        <TaskListSection
          title="Overdue"
          description="Past-due open tasks"
          icon={AlertCircle}
          emptyTitle="Nothing overdue"
          emptyDescription="All tasks are on schedule or have no due date."
          items={today.overdue.map(({ task, projectName, daysOverdue }) => ({
            task,
            projectName,
            meta: `${daysOverdue}d overdue`,
            variant: "overdue" as const,
          }))}
        />

        <TaskListSection
          title="Blocked"
          description="Tasks waiting on a dependency or decision"
          icon={AlertCircle}
          emptyTitle="No blockers"
          emptyDescription="Nothing is marked blocked right now."
          items={today.blocked}
          variant="blocked"
        />

        <TaskListSection
          title="High priority open"
          description="Critical and high priority work in flight"
          icon={Sparkles}
          emptyTitle="No high-priority work"
          emptyDescription="No critical or high priority tasks are open."
          items={today.highPriorityOpen}
        />
      </div>

      {activeSignals.length > 0 ? (
        <TodaySection
          title="Signals"
          description="Critical and high-priority items from your workspace feed"
          icon={Zap}
        >
          <ul className="space-y-2">
            {activeSignals.map((signal) => (
              <li key={signal.id}>
                <Link
                  href="/signals"
                  className="block rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3 transition-colors hover:border-zinc-700"
                >
                  <p className="text-sm font-medium text-zinc-100">
                    {signal.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                    {signal.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </TodaySection>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <TodaySection
          title="Decisions needing review"
          description="Active decisions at or past review date"
          icon={Scale}
        >
          {today.decisionsNeedingReview.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No decisions due"
              description="No active decisions need review today."
            />
          ) : (
            <ul className="space-y-3">
              {today.decisionsNeedingReview.map(
                ({ decision, projectName, daysUntilReview }) => (
                  <li
                    key={decision.id}
                    className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium text-zinc-100">{decision.title}</p>
                      <StatusBadge domain="decision" status={decision.status} />
                    </div>
                    {projectName ? (
                      <p className="mt-1 text-xs text-zinc-500">{projectName}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-zinc-600">
                      {daysUntilReview < 0
                        ? `${Math.abs(daysUntilReview)} days overdue`
                        : daysUntilReview === 0
                          ? "Due today"
                          : `Due in ${daysUntilReview} days`}
                      {decision.reviewDate
                        ? ` · ${format(parseISO(decision.reviewDate), "MMM d, yyyy")}`
                        : null}
                    </p>
                  </li>
                ),
              )}
            </ul>
          )}
        </TodaySection>

      </div>

      <AddNoteDialog open={noteOpen} onOpenChange={setNoteOpen} />
    </div>
  );
}

function TaskListSection({
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
  items,
  variant,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  emptyTitle: string;
  emptyDescription: string;
  items: Array<{
    task: import("@/lib/types").Task;
    projectName: string;
    meta?: string;
    variant?: "overdue" | "blocked";
  }>;
  variant?: "blocked";
}) {
  return (
    <TodaySection title={title} description={description} icon={icon}>
      {items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <ul className="space-y-3">
          {items.map(({ task, projectName, meta, variant: itemVariant }) => (
            <TodayTaskRow
              key={task.id}
              task={task}
              projectName={projectName}
              meta={meta}
              className={
                itemVariant === "overdue" || variant === "blocked"
                  ? itemVariant === "overdue"
                    ? "border-red-900/40 bg-red-950/20"
                    : "border-amber-900/40 bg-amber-950/15"
                  : undefined
              }
            />
          ))}
        </ul>
      )}
    </TodaySection>
  );
}
