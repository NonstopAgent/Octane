"use client";

import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  DollarSign,
  FolderKanban,
  ListTodo,
  Scale,
  Sparkles,
  Timer,
  TrendingUp,
} from "lucide-react";
import { useMemo, type ComponentType } from "react";
import { useShallow } from "zustand/react/shallow";

import { PageHeader } from "@/components/layout/page-header";
import {
  EmptyState,
  MetricCard,
  PriorityBadge,
  StatusBadge,
} from "@/components/modules";
import { formatStatusLabel } from "@/components/modules/badge-tones";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/finance/metrics";
import { generateWeeklyReview } from "@/lib/review/weekly-review";
import type { WeeklyReviewTaskRef } from "@/lib/review/weekly-review";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";
import type { TaskPriority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function ReviewSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "border-zinc-800/80 bg-zinc-900/40 ring-zinc-800/60",
        className,
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Icon className="size-4 text-amber-400/90" aria-hidden />
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-zinc-500">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TaskList({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: WeeklyReviewTaskRef[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map(({ task, projectName }) => (
        <li
          key={task.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm"
        >
          <div>
            <span className="font-medium text-zinc-100">{task.title}</span>
            <span className="text-zinc-500"> · {projectName}</span>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={task.priority as TaskPriority} />
            <StatusBadge domain="task" status={task.status as TaskStatus} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function ReviewPage() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));

  const review = useMemo(() => generateWeeklyReview(state), [state]);

  const weekLabel = `${format(parseISO(review.weekStart), "MMM d")} – ${format(parseISO(review.weekEnd), "MMM d, yyyy")}`;

  return (
    <div className="space-y-8 overflow-x-hidden">
      <PageHeader
        title="Weekly Review"
        description={`Monday-start week · ${weekLabel} · generated ${format(new Date(review.generatedAt), "MMM d, yyyy 'at' h:mm a")}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Completed tasks"
          value={review.completedTasksThisWeek.length}
          subtitle="This week"
          icon={CheckCircle2}
        />
        <MetricCard
          title="New tasks"
          value={review.newTasksThisWeek.length}
          subtitle="Created this week"
          icon={ListTodo}
        />
        <MetricCard
          title="Blocked tasks"
          value={review.blockedTasks.length}
          subtitle="Currently blocked"
          icon={AlertTriangle}
        />
        <MetricCard
          title="Work sessions"
          value={review.completedWorkSessionsThisWeek.length}
          subtitle={`${review.totalWorkMinutesThisWeek} min logged`}
          icon={Timer}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Weekly revenue"
          value={formatCurrency(review.moneyThisWeek.revenue)}
          icon={TrendingUp}
        />
        <MetricCard
          title="Weekly expenses"
          value={formatCurrency(review.moneyThisWeek.expenses)}
          icon={DollarSign}
        />
        <MetricCard
          title="Weekly net"
          value={formatCurrency(review.moneyThisWeek.net)}
          icon={DollarSign}
          trend={{
            label:
              review.moneyThisWeek.net >= 0 ? "Positive week" : "Negative week",
            direction: review.moneyThisWeek.net >= 0 ? "up" : "down",
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReviewSection
          title="Completed this week"
          description="Tasks finished during the review window"
          icon={CheckCircle2}
        >
          <TaskList
            items={review.completedTasksThisWeek}
            emptyTitle="No completions yet"
            emptyDescription="Move tasks to done this week to see them here."
          />
        </ReviewSection>

        <ReviewSection
          title="New this week"
          description="Tasks created during the review window"
          icon={Sparkles}
        >
          <TaskList
            items={review.newTasksThisWeek}
            emptyTitle="No new tasks"
            emptyDescription="New tasks created this week will appear here."
          />
        </ReviewSection>
      </div>

      <ReviewSection
        title="Blocked tasks"
        description="Work waiting on a dependency or decision"
        icon={AlertTriangle}
      >
        <TaskList
          items={review.blockedTasks}
          emptyTitle="Nothing blocked"
          emptyDescription="No tasks are in blocked status."
        />
      </ReviewSection>

      <ReviewSection
        title="Work sessions completed"
        description="Focused execution blocks logged this week"
        icon={Timer}
      >
        {review.completedWorkSessionsThisWeek.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No completed sessions"
            description="Complete a work session on Today to track focused time."
          />
        ) : (
          <ul className="space-y-2">
            {review.completedWorkSessionsThisWeek.map((session) => (
              <li
                key={session.id}
                className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm"
              >
                <p className="font-medium text-zinc-100">{session.title}</p>
                <p className="text-zinc-500">
                  {session.durationMinutes ?? 0} min
                  {session.outcome ? ` · ${session.outcome}` : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ReviewSection>

      <ReviewSection
        title="Money this week"
        description="Transactions dated within the review window"
        icon={DollarSign}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm">
            <p className="text-zinc-500">Revenue</p>
            <p className="text-lg font-semibold text-emerald-400">
              {formatCurrency(review.moneyThisWeek.revenue)}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm">
            <p className="text-zinc-500">Expenses</p>
            <p className="text-lg font-semibold text-red-400">
              {formatCurrency(review.moneyThisWeek.expenses)}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm">
            <p className="text-zinc-500">Net</p>
            <p className="text-lg font-semibold text-zinc-100">
              {formatCurrency(review.moneyThisWeek.net)}
            </p>
          </div>
        </div>
      </ReviewSection>

      <ReviewSection
        title="Decisions made"
        description="New decision records created this week"
        icon={Scale}
      >
        {review.decisionsMadeThisWeek.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No new decisions"
            description="Decisions created this week will show up here."
          />
        ) : (
          <ul className="space-y-2">
            {review.decisionsMadeThisWeek.map((decision) => (
              <li
                key={decision.id}
                className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm"
              >
                <p className="font-medium text-zinc-100">{decision.title}</p>
                <p className="line-clamp-2 text-zinc-500">{decision.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </ReviewSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReviewSection
          title="Projects advanced"
          description="Active projects with meaningful activity this week"
          icon={FolderKanban}
        >
          {review.projectsAdvanced.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No project momentum"
              description="Complete tasks, log sessions, or record transactions to advance projects."
            />
          ) : (
            <ul className="space-y-2">
              {review.projectsAdvanced.map(({ project, reason }) => (
                <li
                  key={project.id}
                  className="rounded-lg border border-emerald-900/30 bg-emerald-950/20 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-zinc-100">{project.name}</p>
                  <p className="text-zinc-500">{reason}</p>
                </li>
              ))}
            </ul>
          )}
        </ReviewSection>

        <ReviewSection
          title="Projects neglected"
          description="High-priority projects without updates in 7+ days"
          icon={AlertTriangle}
        >
          {review.projectsNeglected.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No neglected projects"
              description="Critical and high-priority projects have recent updates."
            />
          ) : (
            <ul className="space-y-2">
              {review.projectsNeglected.map(({ project, reason }) => (
                <li
                  key={project.id}
                  className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-sm"
                >
                  <p className="font-medium text-zinc-100">{project.name}</p>
                  <p className="text-zinc-500">
                    {reason} · {formatStatusLabel(project.priority)} priority
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ReviewSection>
      </div>

      <ReviewSection
        title="Suggested next-week priorities"
        description="Deterministic ranking from blocked work, overdue tasks, and risk signals"
        icon={ClipboardCheck}
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-200">
          {review.suggestedNextWeekPriorities.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </ReviewSection>
    </div>
  );
}
