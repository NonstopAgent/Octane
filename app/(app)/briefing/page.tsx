"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertCircle,
  CalendarClock,
  DollarSign,
  GitBranch,
  History,
  Landmark,
} from "lucide-react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { AgentMonitorTable } from "@/components/modules/agents/agent-monitor-table";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, MetricCard } from "@/components/modules";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatRunway } from "@/lib/dashboard/metrics";
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
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-zinc-800/80 bg-zinc-900/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-zinc-100">
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Morning Briefing"
        description={`Read-only daily digest · ${format(new Date(briefing.generatedAt), "EEEE, MMM d")}`}
      />

      {briefing.operationalRiskAlerts.length > 0 && (
        <div className="rounded-lg border border-orange-900/40 bg-orange-950/15 px-4 py-3">
          <p className="text-sm font-medium text-orange-200 mb-1">
            Operational score penalties
          </p>
          <ul className="list-disc list-inside text-xs text-zinc-400 space-y-0.5">
            {briefing.operationalRiskAlerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Octane score"
          value={briefing.octaneScore}
          subtitle={
            briefing.octaneScorePenalty > 0
              ? `−${briefing.octaneScorePenalty} ops penalty`
              : "0–100 composite"
          }
          icon={AlertCircle}
        />
        <MetricCard
          title="Monthly revenue"
          value={formatCurrency(briefing.cashSnapshot.monthlyRevenue)}
          icon={DollarSign}
        />
        <MetricCard
          title="Monthly burn"
          value={formatCurrency(briefing.cashSnapshot.monthlyExpenses)}
          icon={DollarSign}
        />
        <MetricCard
          title="Runway"
          value={formatRunway(briefing.cashSnapshot.runwayMonths)}
          icon={DollarSign}
        />
        <MetricCard
          title="Blocked tasks"
          value={String(briefing.blockedTasksCount)}
          icon={AlertCircle}
        />
      </div>

      <BriefingSection
        title="Last 24 hours"
        description="Workspace activity since yesterday"
        icon={History}
      >
        {briefing.recentActivity24h.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No logged activity in the last day — execute work on Today to build
            history.
          </p>
        ) : (
          <ul className="space-y-2">
            {briefing.recentActivity24h.map((log) => (
              <li
                key={log.id}
                className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm"
              >
                <p className="text-zinc-200">{log.description}</p>
                <p className="mt-1 text-[11px] text-zinc-600">
                  {log.entityType} · {log.action} ·{" "}
                  {formatDistanceToNow(new Date(log.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </BriefingSection>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
          <GitBranch className="size-3.5" aria-hidden />
          Portfolio repos (GitHub)
        </h2>
        <AgentMonitorTable />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BriefingSection
          title="Cash & runway"
          description="Monthly revenue, burn, and runway estimate"
          icon={DollarSign}
        >
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-600">
                Revenue
              </dt>
              <dd className="mt-1 font-semibold text-emerald-200 tabular-nums">
                {formatCurrency(briefing.cashSnapshot.monthlyRevenue)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-600">
                Expenses
              </dt>
              <dd className="mt-1 font-semibold text-zinc-100 tabular-nums">
                {formatCurrency(briefing.cashSnapshot.monthlyExpenses)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-600">
                Runway
              </dt>
              <dd className="mt-1 font-semibold text-amber-200 tabular-nums">
                {formatRunway(briefing.cashSnapshot.runwayMonths)}
              </dd>
            </div>
          </dl>
          {briefing.financialAlerts.length > 0 ? (
            <ul className="mt-4 space-y-2">
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
          ) : null}
        </BriefingSection>

        <BriefingSection
          title="Compliance horizon"
          description="Upcoming filings and reminders (next 30 days)"
          icon={Landmark}
        >
          {briefing.upcomingCompliance.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Clear compliance window"
              description="No compliance reminders due in the next 30 days."
            />
          ) : (
            <ul className="space-y-2">
              {briefing.upcomingCompliance.map(({ reminder, daysUntilDue }) => {
                const entityLabel = reminder.entityId
                  ? state.entities.find((e) => e.id === reminder.entityId)?.name
                  : undefined;
                return (
                <li
                  key={reminder.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100">
                      {reminder.title}
                    </p>
                    {entityLabel ? (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {entityLabel}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-800/80 text-amber-200"
                  >
                    {daysUntilDue === 0
                      ? "Today"
                      : daysUntilDue === 1
                        ? "Tomorrow"
                        : `${daysUntilDue}d`}
                    {reminder.dueDate
                      ? ` · ${format(parseISO(reminder.dueDate), "MMM d")}`
                      : null}
                  </Badge>
                </li>
              );
              })}
            </ul>
          )}
        </BriefingSection>
      </div>

      <p className="text-xs text-zinc-600">
        For live execution — overdue tasks, blockers, and work sessions — use{" "}
        <a href="/today" className="text-amber-500 hover:underline">
          Today
        </a>
        .
      </p>
    </div>
  );
}
