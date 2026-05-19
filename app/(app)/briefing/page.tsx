"use client";

import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  Bot,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  FolderKanban,
  ListTodo,
  Sparkles,
  Target,
} from "lucide-react";
import { useMemo, type ComponentType } from "react";
import { useShallow } from "zustand/react/shallow";

import { PageHeader } from "@/components/layout/page-header";
import { OctaneAdvisorPanel } from "@/components/modules/advisor";
import { EmptyState, PriorityBadge, StatusBadge } from "@/components/modules";
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
import { cn } from "@/lib/utils";

function BriefingSection({
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

export default function BriefingPage() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));

  const briefing = useMemo(() => generateMorningBriefing(state), [state]);

  if (state.projects.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Morning Briefing"
          description="Rule-based ops snapshot for your portfolio."
        />
        <EmptyState
          icon={Sparkles}
          title="Nothing to brief yet"
          description="The briefing synthesizes projects, tasks, and finance into a morning plan. Add a project or reset demo data in Settings to get started."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Morning Briefing"
        description={`Rule-based ops snapshot for ${state.profile.name} · generated ${format(new Date(briefing.generatedAt), "MMM d, yyyy 'at' h:mm a")}`}
      />

      <BriefingSection
        title="Today's operating plan"
        description="Suggested flow through your day"
        icon={Target}
      >
        <ul className="space-y-2">
          {briefing.operatingPlan.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-300"
            >
              {item}
            </li>
          ))}
        </ul>
      </BriefingSection>

      <BriefingSection
        title="Top 3 moves"
        description="Highest-leverage actions right now"
        icon={Sparkles}
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-200">
          {briefing.topThreeMoves.map((move) => (
            <li key={move}>{move}</li>
          ))}
        </ol>
      </BriefingSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <BriefingSection
          title="Blocked work"
          description="Tasks stopping progress"
          icon={ListTodo}
        >
          {briefing.blockedWork.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing blocked"
              description="No tasks are in blocked status."
            />
          ) : (
            <ul className="space-y-2">
              {briefing.blockedWork.map(({ task, projectName }) => (
                <li
                  key={task.id}
                  className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-zinc-100">{task.title}</span>
                  <span className="text-zinc-500"> · {projectName}</span>
                </li>
              ))}
            </ul>
          )}
        </BriefingSection>

        <BriefingSection
          title="Money watch"
          description="Burn, revenue, and project spend"
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
      </div>

      <BriefingSection
        title="Suggested focus order"
        description="Deterministic priority stack for today"
        icon={Target}
      >
        <ol className="space-y-1 text-sm text-zinc-300">
          {briefing.suggestedFocusOrder.map((item, i) => (
            <li key={item}>
              {i + 1}. {item}
            </li>
          ))}
        </ol>
      </BriefingSection>

      <BriefingSection
        title="Top priorities"
        description="Highest-signal items for today"
        icon={Target}
      >
        <ul className="space-y-2">
          {briefing.topPriorities.map((item) => (
            <li
              key={item}
              className="flex gap-2 rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-200"
            >
              <Sparkles
                className="mt-0.5 size-4 shrink-0 text-amber-400"
                aria-hidden
              />
              {item}
            </li>
          ))}
        </ul>
      </BriefingSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <BriefingSection
          title="Overdue"
          description="Tasks past due date"
          icon={ListTodo}
        >
          {briefing.overdueTasks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing overdue"
              description="All tasks are on schedule or have no due date."
            />
          ) : (
            <ul className="space-y-3">
              {briefing.overdueTasks.map(({ task, projectName, daysOverdue }) => (
                <li
                  key={task.id}
                  className="rounded-lg border border-red-900/40 bg-red-950/20 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-zinc-100">{task.title}</p>
                    <Badge
                      variant="outline"
                      className="border-red-800/80 text-red-300"
                    >
                      {daysOverdue}d overdue
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{projectName}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge domain="task" status={task.status} />
                    <PriorityBadge priority={task.priority} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BriefingSection>

        <BriefingSection
          title="Upcoming deadlines"
          description="Tasks and decision reviews in the next 14 days"
          icon={CalendarClock}
        >
          {briefing.upcomingDeadlines.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No upcoming deadlines"
              description="Nothing due in the next two weeks."
            />
          ) : (
            <ul className="space-y-3">
              {briefing.upcomingDeadlines.map((deadline) => (
                <li
                  key={`${deadline.kind}-${deadline.id}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3"
                >
                  <div>
                    <p className="font-medium text-zinc-100">{deadline.label}</p>
                    {deadline.detail ? (
                      <p className="mt-1 text-xs text-zinc-500">{deadline.detail}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-xs font-medium text-amber-300/90">
                    {format(parseISO(deadline.date), "MMM d")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </BriefingSection>

        <BriefingSection
          title="Project watchlist"
          description="Stale projects and decision queue"
          icon={FolderKanban}
        >
          {briefing.projectWatchlist.length === 0 &&
          briefing.decisionQueue.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Watchlist clear"
              description="No stale projects or decisions due for review."
            />
          ) : (
            <ul className="space-y-3">
              {briefing.projectWatchlist.map(({ project, daysSinceUpdate }) => (
                <li
                  key={project.id}
                  className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3"
                >
                  <p className="font-medium text-zinc-100">{project.name}</p>
                  <p className="text-xs text-zinc-500">
                    {daysSinceUpdate}d without update
                  </p>
                </li>
              ))}
              {briefing.decisionQueue.slice(0, 3).map(({ decision }) => (
                <li
                  key={decision.id}
                  className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3"
                >
                  <p className="font-medium text-zinc-100">{decision.title}</p>
                  <p className="text-xs text-zinc-500">Decision due for review</p>
                </li>
              ))}
            </ul>
          )}
        </BriefingSection>

        <BriefingSection
          title="Projects needing attention"
          description="No updates in 7+ days"
          icon={FolderKanban}
        >
          {briefing.staleProjects.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Projects are current"
              description="Every project was updated within the last week."
            />
          ) : (
            <ul className="space-y-3">
              {briefing.staleProjects.map(({ project, daysSinceUpdate }) => (
                <li
                  key={project.id}
                  className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-zinc-100">{project.name}</p>
                    <Badge variant="outline" className="border-amber-800/80 text-amber-200">
                      {daysSinceUpdate}d stale
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge domain="project" status={project.status} />
                    <PriorityBadge priority={project.priority} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BriefingSection>

        <BriefingSection
          title="Agent issues"
          description="Agents in error state"
          icon={Bot}
        >
          {briefing.agentIssues.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Agents healthy"
              description="No agents are reporting errors."
            />
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
                  <p className="mt-2 text-xs text-zinc-500">{agent.purpose}</p>
                  {agent.currentTask ? (
                    <p className="mt-1 text-xs text-zinc-600">
                      Task ref: {agent.currentTask}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </BriefingSection>

        <BriefingSection
          title="Financial alerts"
          description="Burn vs revenue this month"
          icon={DollarSign}
        >
          {briefing.financialAlerts.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Finances look OK"
              description="Monthly expenses are not exceeding revenue."
            />
          ) : (
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
          )}
          {briefing.blockedTasksCount > 0 ? (
            <p className="mt-4 text-xs text-zinc-600">
              Also tracking {briefing.blockedTasksCount} blocked task
              {briefing.blockedTasksCount === 1 ? "" : "s"} across projects.
            </p>
          ) : null}
        </BriefingSection>

        <BriefingSection
          title="Decisions due"
          description="Active decisions at or past review date"
          icon={AlertCircle}
        >
          {briefing.decisionsDue.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No decisions due"
              description="No active decisions need review today."
            />
          ) : (
            <ul className="space-y-3">
              {briefing.decisionsDue.map(
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
        </BriefingSection>
      </div>

      <BriefingSection
        title="Suggested actions"
        description="Deduped recommendations from briefing rules"
        icon={Sparkles}
      >
        <ul className="space-y-2">
          {briefing.suggestedActions.map((action) => (
            <li
              key={action}
              className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-300"
            >
              {action}
            </li>
          ))}
        </ul>
      </BriefingSection>

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
