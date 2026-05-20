"use client";

import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import {
  AlertCircle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock,
  DollarSign,
  FolderKanban,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useMemo, type ComponentType } from "react";
import { useShallow } from "zustand/react/shallow";

import { PageHeader } from "@/components/layout/page-header";
import { OctaneAdvisorPanel } from "@/components/modules/advisor";
import { EmptyState, StatusBadge } from "@/components/modules";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { generateMorningBriefing } from "@/lib/briefing/generate-briefing";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";

function BriefingSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-zinc-800/80 bg-zinc-900/40">
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

function StatPill({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "amber" | "red" | "green";
}) {
  const bg =
    tone === "red"
      ? "border-red-900/40 bg-red-950/20"
      : tone === "amber"
        ? "border-amber-900/40 bg-amber-950/20"
        : tone === "green"
          ? "border-emerald-900/30 bg-emerald-950/15"
          : "border-zinc-800/80 bg-zinc-900/40";
  const val =
    tone === "red"
      ? "text-red-200"
      : tone === "amber"
        ? "text-amber-200"
        : tone === "green"
          ? "text-emerald-200"
          : "text-zinc-100";

  return (
    <div className={`rounded-xl border px-4 py-3 ${bg}`}>
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${val}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-zinc-600">{sub}</p> : null}
    </div>
  );
}

export default function BriefingPage() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));

  const briefing = useMemo(() => generateMorningBriefing(state), [state]);

  // Portfolio-level stats for the health strip
  const stats = useMemo(() => {
    const openProjects = state.projects.filter(
      (p) => p.status !== "complete" && p.status !== "archived",
    ).length;
    const openTasks = state.tasks.filter(
      (t) => t.status !== "done",
    ).length;
    const overdueCount = briefing.overdueTasks.length;
    const blockedCount = briefing.blockedWork.length;
    return { openProjects, openTasks, overdueCount, blockedCount };
  }, [state, briefing]);

  if (state.projects.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Morning Briefing"
          description="Strategic digest for your portfolio — read once, then execute."
        />
        <EmptyState
          icon={Sparkles}
          title="Nothing to brief yet"
          description="The briefing synthesizes projects, tasks, and finance into a strategic morning read. Add a project in /projects to get started."
        />
      </div>
    );
  }

  const today = startOfDay(new Date());

  return (
    <div className="space-y-8">
      <PageHeader
        title="Morning Briefing"
        description={`Strategic digest for ${state.profile.name} · ${format(new Date(briefing.generatedAt), "EEEE, MMM d")}`}
      />

      {/* Portfolio health strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill label="Open projects" value={stats.openProjects} />
        <StatPill label="Open tasks" value={stats.openTasks} />
        <StatPill
          label="Overdue"
          value={stats.overdueCount}
          tone={stats.overdueCount > 0 ? "red" : "neutral"}
          sub={stats.overdueCount > 0 ? "need attention" : "clear"}
        />
        <StatPill
          label="Blocked"
          value={stats.blockedCount}
          tone={stats.blockedCount > 0 ? "amber" : "neutral"}
          sub={stats.blockedCount > 0 ? "holding progress" : "clear"}
        />
      </div>

      {/* Operating plan — unique to briefing; Today shows tasks, briefing shows flow */}
      <BriefingSection
        title="Today's operating plan"
        description="Recommended sequence for your day based on current portfolio state"
        icon={Clock}
      >
        {briefing.operatingPlan.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Portfolio looks healthy — execute highest-impact in-progress work.
          </p>
        ) : (
          <ol className="space-y-3">
            {briefing.operatingPlan.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-400">
                  {i + 1}
                </span>
                <span className="text-zinc-200">{step}</span>
              </li>
            ))}
          </ol>
        )}
      </BriefingSection>

      {/* Upcoming deadlines — forward-looking calendar view; Today shows only today */}
      <BriefingSection
        title="Upcoming deadlines"
        description="Tasks and decision reviews due in the next 14 days"
        icon={CalendarClock}
      >
        {briefing.upcomingDeadlines.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Clear horizon"
            description="Nothing due in the next two weeks."
          />
        ) : (
          <ul className="space-y-2">
            {briefing.upcomingDeadlines.map((deadline) => {
              const daysAway = differenceInCalendarDays(
                startOfDay(parseISO(deadline.date)),
                today,
              );
              const urgency =
                daysAway <= 2
                  ? "border-red-900/40 bg-red-950/20"
                  : daysAway <= 5
                    ? "border-amber-900/40 bg-amber-950/15"
                    : "border-zinc-800/90 bg-zinc-950/40";

              return (
                <li
                  key={`${deadline.kind}-${deadline.id}`}
                  className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${urgency}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100 truncate">{deadline.label}</p>
                    {deadline.detail ? (
                      <p className="mt-0.5 text-xs text-zinc-500">{deadline.detail}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="text-xs font-semibold text-amber-300/90">
                      {format(parseISO(deadline.date), "MMM d")}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {daysAway === 0
                        ? "today"
                        : daysAway === 1
                          ? "tomorrow"
                          : `${daysAway}d away`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </BriefingSection>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Money watch — full financial snapshot (Today shows alerts only) */}
        <BriefingSection
          title="Money watch"
          description="Burn vs revenue across the portfolio"
          icon={DollarSign}
        >
          <ul className="space-y-2">
            {briefing.moneyWatch.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-300"
              >
                {item}
              </li>
            ))}
          </ul>
        </BriefingSection>

        {/* Agent health — operational system status */}
        <BriefingSection
          title="Agent health"
          description="AI operators and their current status"
          icon={Bot}
        >
          {state.agents.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No agents configured"
              description="Add agents in Settings to monitor AI operator health."
            />
          ) : briefing.agentIssues.length === 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-emerald-900/30 bg-emerald-950/15 px-3 py-2 text-sm text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" />
                All {state.agents.length} agent{state.agents.length === 1 ? "" : "s"} healthy
              </div>
            </div>
          ) : (
            <ul className="space-y-3">
              {briefing.agentIssues.map((agent) => (
                <li
                  key={agent.id}
                  className="rounded-lg border border-red-900/40 bg-red-950/20 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-zinc-100">{agent.name}</p>
                    <StatusBadge domain="agent" status={agent.status} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{agent.purpose}</p>
                </li>
              ))}
            </ul>
          )}
        </BriefingSection>

        {/* Decision queue — decisions coming up (Today shows ones due now) */}
        <BriefingSection
          title="Decision queue"
          description="Active decisions pending review"
          icon={TrendingUp}
        >
          {briefing.decisionsDue.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No decisions due"
              description="All active decisions are on schedule."
            />
          ) : (
            <ul className="space-y-3">
              {briefing.decisionsDue.map(({ decision, projectName, daysUntilReview }) => (
                <li
                  key={decision.id}
                  className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-zinc-100">{decision.title}</p>
                    <Badge
                      variant="outline"
                      className={
                        daysUntilReview < 0
                          ? "border-red-800/80 text-red-300"
                          : "border-amber-800/80 text-amber-200"
                      }
                    >
                      {daysUntilReview < 0
                        ? `${Math.abs(daysUntilReview)}d overdue`
                        : daysUntilReview === 0
                          ? "Due today"
                          : `In ${daysUntilReview}d`}
                    </Badge>
                  </div>
                  {projectName ? (
                    <p className="mt-1 text-xs text-zinc-500">{projectName}</p>
                  ) : null}
                  {decision.reviewDate ? (
                    <p className="mt-1 text-xs text-zinc-600">
                      Review date: {format(parseISO(decision.reviewDate), "MMM d, yyyy")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </BriefingSection>

        {/* Project watchlist — stale bets needing a check-in */}
        <BriefingSection
          title="Project watchlist"
          description="Bets with no updates in 7+ days"
          icon={FolderKanban}
        >
          {briefing.projectWatchlist.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All projects current"
              description="Every project was updated within the last week."
            />
          ) : (
            <ul className="space-y-3">
              {briefing.projectWatchlist.map(({ project, daysSinceUpdate }) => (
                <li
                  key={project.id}
                  className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-zinc-100">{project.name}</p>
                    <Badge
                      variant="outline"
                      className="border-amber-800/80 text-amber-200"
                    >
                      {daysSinceUpdate}d stale
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {project.priority} priority · {project.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </BriefingSection>
      </div>

      {/* Suggested actions — concrete next steps */}
      <BriefingSection
        title="Recommended actions"
        description="Specific moves based on your current portfolio state"
        icon={Sparkles}
      >
        {briefing.suggestedActions.length === 0 ? (
          <p className="text-sm text-zinc-400">No urgent actions — stay in execution mode.</p>
        ) : (
          <ul className="space-y-2">
            {briefing.suggestedActions.map((action, i) => (
              <li
                key={action}
                className="flex gap-3 rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-semibold text-amber-300">
                  {i + 1}
                </span>
                <span className="text-zinc-200">{action}</span>
              </li>
            ))}
          </ul>
        )}
      </BriefingSection>

      {/* Financial alerts as a distinct warning section */}
      {briefing.financialAlerts.length > 0 ? (
        <BriefingSection
          title="Financial alerts"
          description="Burn vs revenue flags requiring attention"
          icon={AlertCircle}
        >
          <ul className="space-y-2">
            {briefing.financialAlerts.map((alert) => (
              <li
                key={alert}
                className="flex gap-2 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {alert}
              </li>
            ))}
          </ul>
        </BriefingSection>
      ) : null}

      {/* Octane Advisor — AI strategic analysis panel */}
      <BriefingSection
        title="Octane Advisor"
        description="Rule-based strategic insights from your current operating state"
        icon={Sparkles}
      >
        <OctaneAdvisorPanel context="briefing" />
      </BriefingSection>
    </div>
  );
}
