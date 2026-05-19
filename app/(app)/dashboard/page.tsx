"use client";

import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Bot,
  Briefcase,
  CheckSquare,
  ChevronRight,
  Clock,
  DollarSign,
  FileWarning,
  FolderKanban,
  Gauge,
  ListChecks,
  Scale,
  Telescope,
  TrendingDown,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { PageHeader } from "@/components/layout/page-header";
import { OctaneAdvisorPanel } from "@/components/modules/advisor";
import { EmptyState, MetricCard, StatusBadge } from "@/components/modules";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatCurrency,
  formatRunway,
  selectDashboardMetrics,
} from "@/lib/dashboard/metrics";
import { generateOctaneOutlook } from "@/lib/outlook/generate-octane-outlook";
import { computeOctaneScore } from "@/lib/scoring/octane-score";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-zinc-800", className)}
    >
      <div
        className="h-full rounded-full bg-amber-500/80 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));

  const metrics = useMemo(() => selectDashboardMetrics(state), [state]);
  const octaneScore = useMemo(() => computeOctaneScore(state), [state]);
  const outlook = useMemo(() => generateOctaneOutlook(state), [state]);

  if (state.projects.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Dashboard"
          description={`Command center overview for ${state.profile.name}.`}
        />
        <EmptyState
          icon={FolderKanban}
          title="No portfolio data yet"
          description="The dashboard summarizes health across projects, tasks, and finance. Create a project first, or reset demo data in Settings."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Command center overview for ${state.profile.name}.`}
      />

      <Link
        href="/outlook"
        className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 transition-colors hover:border-amber-900/40"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Telescope className="size-4 shrink-0 text-amber-400/90" aria-hidden />
            Current Outlook
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-zinc-500">
            {outlook.recommendedFocus[0] ?? outlook.summary}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-2xl font-bold tabular-nums text-zinc-100">
            {outlook.outlookScore}
          </span>
          <ChevronRight className="size-4 text-zinc-600" aria-hidden />
        </div>
      </Link>

      <section className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card className="border-zinc-800/80 bg-zinc-900/40 ring-zinc-800/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Gauge className="size-4 text-amber-400" aria-hidden />
              Octane Score
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Overall operating health (0–100)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums text-amber-300">
              {octaneScore.score}
            </p>
            <ul className="mt-4 space-y-1 text-xs text-zinc-500">
              {octaneScore.suggestions.slice(0, 3).map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["Task completion", octaneScore.breakdown.taskCompletion],
              ["Blocked work", octaneScore.breakdown.blockedTasks],
              ["Project freshness", octaneScore.breakdown.staleProjects],
              ["Revenue vs spend", octaneScore.breakdown.revenueVsExpenses],
              ["Agent health", octaneScore.breakdown.agentErrors],
              ["Decisions", octaneScore.breakdown.decisionsDue],
              ["Documents", octaneScore.breakdown.documentsReview],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3"
            >
              <p className="text-xs text-zinc-500">{label}</p>
              <p className="text-lg font-semibold tabular-nums text-zinc-100">
                {value}
              </p>
              <ProgressBar value={value} className="mt-2" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Active Projects"
          value={metrics.activeProjectsCount}
          subtitle="Excludes paused & killed"
          icon={FolderKanban}
        />
        <MetricCard
          title="Open Tasks"
          value={metrics.openTasksCount}
          subtitle="Not marked done"
          icon={CheckSquare}
        />
        <MetricCard
          title="Active Agents"
          value={metrics.activeAgentsCount}
          subtitle="Running or idle"
          icon={Bot}
        />
        <MetricCard
          title="Pending Decisions"
          value={metrics.pendingDecisionsCount}
          subtitle="Active & under review"
          icon={Scale}
        />
        <MetricCard
          title="Monthly Revenue"
          value={formatCurrency(metrics.monthlyRevenue)}
          subtitle="This calendar month"
          icon={DollarSign}
          trend={
            metrics.monthlyRevenue > 0
              ? { label: "Revenue transactions", direction: "up" }
              : { label: "No revenue yet", direction: "neutral" }
          }
        />
        <MetricCard
          title="Monthly Expenses"
          value={formatCurrency(metrics.monthlyExpenses)}
          subtitle="Operating spend this month"
          icon={TrendingDown}
        />
        <MetricCard
          title="Burn Rate"
          value={formatCurrency(metrics.burnRate)}
          subtitle="Same as monthly expenses"
          icon={Gauge}
        />
        <MetricCard
          title="Runway"
          value={formatRunway(metrics.runwayMonths)}
          subtitle={`${formatCurrency(metrics.cashAvailable)} cash available`}
          icon={Wallet}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-zinc-800/80 bg-zinc-900/40 ring-zinc-800/60">
          <CardHeader>
            <CardTitle className="text-zinc-100">Project Status Board</CardTitle>
            <CardDescription className="text-zinc-500">
              Active bets and build progress
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.projectBoard.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No active projects"
                description="All projects are paused or killed."
              />
            ) : (
              metrics.projectBoard.map(({ project }) => (
                <div
                  key={project.id}
                  className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-4"
                >
                  <div
                    className="mb-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <p className="font-medium text-zinc-100">{project.name}</p>
                    <StatusBadge domain="project" status={project.status} />
                  </div>
                  <ProgressBar value={project.progress} />
                  <p className="mt-2 text-xs text-zinc-500">
                    {project.progress}% · {project.currentPhase ?? "No phase set"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/40 ring-zinc-800/60">
          <CardHeader>
            <CardTitle className="text-zinc-100">Agent Activity Feed</CardTitle>
            <CardDescription className="text-zinc-500">
              Recent agent runs and assignments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.agentFeed.length === 0 ? (
              <EmptyState
                icon={Bot}
                title="No agents"
                description="Add agents to monitor automated work."
              />
            ) : (
              metrics.agentFeed.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-100">{agent.name}</p>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {agent.currentTaskTitle ?? agent.purpose}
                    </p>
                  </div>
                  <StatusBadge domain="agent" status={agent.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/40 ring-zinc-800/60">
          <CardHeader>
            <CardTitle className="text-zinc-100">Recent Decisions</CardTitle>
            <CardDescription className="text-zinc-500">
              Last five logged decisions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.recentDecisions.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No decisions"
                description="Log strategic decisions as you make them."
              />
            ) : (
              metrics.recentDecisions.map((decision) => (
                <div
                  key={decision.id}
                  className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-zinc-100">{decision.title}</p>
                    <StatusBadge domain="decision" status={decision.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                    {decision.summary}
                  </p>
                  {decision.reviewDate ? (
                    <p className="mt-2 text-xs text-zinc-600">
                      Review {format(parseISO(decision.reviewDate), "MMM d, yyyy")}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-zinc-900/40 ring-zinc-800/60">
          <CardHeader>
            <CardTitle className="text-zinc-100">
              Capital Allocation Snapshot
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Net capital by project from transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.capitalAllocation.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No transactions"
                description="Record transactions to see allocation."
              />
            ) : (
              metrics.capitalAllocation.map((row) => (
                <div
                  key={row.projectId ?? "unallocated"}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      {row.projectName}
                    </p>
                    <p className="text-xs text-zinc-600">
                      In {formatCurrency(row.inflow)} · Out{" "}
                      {formatCurrency(row.outflow)}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      row.netAmount >= 0 ? "text-emerald-400" : "text-red-400",
                    )}
                  >
                    {formatCurrency(row.netAmount)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800/80 bg-zinc-900/40 ring-zinc-800/60">
        <CardHeader>
          <CardTitle className="text-zinc-100">Strategic Advisor</CardTitle>
          <CardDescription className="text-zinc-500">
            Rule-based analysis of your current operating state
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OctaneAdvisorPanel context="dashboard" />
        </CardContent>
      </Card>

      <Card className="border-zinc-800/80 bg-zinc-900/40 ring-zinc-800/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <FileWarning className="size-4 text-amber-400" aria-hidden />
            Compliance & Deadline Reminders
          </CardTitle>
          <CardDescription className="text-zinc-500">
            Documents needing review and upcoming decision dates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.complianceReminders.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="All clear"
              description="No documents or decision reviews due in the next 30 days."
            />
          ) : (
            metrics.complianceReminders.map((item) =>
              item.kind === "document" ? (
                <div
                  key={item.document.id}
                  className="flex items-start gap-3 rounded-lg border border-amber-900/40 bg-amber-950/20 p-3"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-amber-400"
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      {item.document.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Document needs review · {item.document.category}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  key={item.decision.id}
                  className="flex items-start gap-3 rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3"
                >
                  <Clock
                    className="mt-0.5 size-4 shrink-0 text-zinc-400"
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      {item.decision.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Decision review ·{" "}
                      {format(parseISO(item.reviewDate), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              ),
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
