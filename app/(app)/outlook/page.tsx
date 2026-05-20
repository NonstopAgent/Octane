"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Landmark,
  MessageCircleQuestion,
  PauseCircle,
  Sparkles,
  Target,
  Telescope,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, type ComponentType } from "react";
import { useShallow } from "zustand/react/shallow";

import { PageHeader } from "@/components/layout/page-header";
import { OctaneAdvisorPanel } from "@/components/modules/advisor";
import { AskOctanePanel } from "@/components/modules/outlook/ask-octane-panel";
import { EmptyState, MetricCard } from "@/components/modules";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  generateOctaneOutlook,
  type OutlookDomain,
  type OutlookInsight,
  type OverallOutlookLabel,
} from "@/lib/outlook/generate-octane-outlook";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";
import { isOpenTaskStatus } from "@/lib/dashboard/metrics";
import { cn } from "@/lib/utils";

const OUTLOOK_LABEL_STYLES: Record<
  OverallOutlookLabel,
  { badge: string; text: string }
> = {
  strong: {
    badge: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
    text: "text-emerald-400",
  },
  stable: {
    badge: "border-sky-800/60 bg-sky-950/30 text-sky-300",
    text: "text-sky-400",
  },
  mixed: {
    badge: "border-amber-800/60 bg-amber-950/30 text-amber-300",
    text: "text-amber-400",
  },
  at_risk: {
    badge: "border-orange-800/60 bg-orange-950/30 text-orange-300",
    text: "text-orange-400",
  },
  critical: {
    badge: "border-red-800/60 bg-red-950/30 text-red-300",
    text: "text-red-400",
  },
};

const SEVERITY_STYLES: Record<OutlookInsight["severity"], string> = {
  low: "border-zinc-800/90 bg-zinc-950/40",
  medium: "border-amber-900/40 bg-amber-950/15",
  high: "border-orange-900/40 bg-orange-950/15",
  critical: "border-red-900/40 bg-red-950/20",
};

function domainLabelStyle(label: OutlookDomain["label"]) {
  if (label === "at_risk" || label === "critical") {
    return OUTLOOK_LABEL_STYLES[label];
  }
  if (label === "strong" || label === "stable" || label === "mixed") {
    return OUTLOOK_LABEL_STYLES[label];
  }
  return OUTLOOK_LABEL_STYLES.mixed;
}

function OutlookSection({
  title,
  description,
  icon: Icon,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Card
      id={id}
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

function InsightList({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: OutlookInsight[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-sm",
            SEVERITY_STYLES[item.severity],
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-zinc-100">{item.title}</p>
            <Badge variant="outline" className="border-zinc-700 text-zinc-400 text-[10px]">
              {item.category}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}

function DomainCard({
  title,
  domain,
  icon: Icon,
}: {
  title: string;
  domain: OutlookDomain;
  icon: ComponentType<{ className?: string }>;
}) {
  const styles = domainLabelStyle(domain.label);

  return (
    <Card className="border-zinc-800/80 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm text-zinc-200">
            <Icon className="size-4 text-amber-400/80" aria-hidden />
            {title}
          </CardTitle>
          <Badge variant="outline" className={styles.badge}>
            {domain.label.replace("_", " ")}
          </Badge>
        </div>
        <p className={cn("text-2xl font-semibold", styles.text)}>{domain.score}</p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <p className="text-xs text-zinc-500">{domain.summary}</p>
        <ul className="space-y-1 text-xs text-zinc-400">
          {domain.highlights.map((h) => (
            <li key={h}>· {h}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PlanCard({
  label,
  plan,
}: {
  label: string;
  plan: { theme: string; milestones: string[]; focusAreas: string[] };
}) {
  return (
    <div className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-amber-400/80">
        {label}
      </p>
      <p className="mt-1 font-medium text-zinc-100">{plan.theme}</p>
      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-medium text-zinc-500">Milestones</p>
        <ul className="space-y-1 text-xs text-zinc-400">
          {plan.milestones.map((m) => (
            <li key={m}>· {m}</li>
          ))}
        </ul>
        <p className="text-[11px] font-medium text-zinc-500">Focus</p>
        <ul className="space-y-1 text-xs text-zinc-400">
          {plan.focusAreas.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function OutlookPage() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));

  const outlook = useMemo(() => generateOctaneOutlook(state), [state]);

  const attentionItems = useMemo(() => {
    const criticalTasks = state.tasks.filter(
      (t) =>
        isOpenTaskStatus(t.status) &&
        (t.priority === "critical" || t.status === "blocked"),
    );
    const taskLines = criticalTasks.slice(0, 6).map((t) => {
      const project = state.projects.find((p) => p.id === t.projectId);
      return {
        id: `task-${t.id}`,
        title: t.title,
        description: project ? `${project.name} · ${t.status}` : t.status,
        severity: t.priority === "critical" ? ("high" as const) : ("medium" as const),
        category: "task",
      };
    });
    const improvement = outlook.whatNeedsImprovement.slice(0, 4).map((item, i) => ({
      id: `improve-${i}`,
      title: item,
      description: "Portfolio gap flagged by outlook rules",
      severity: "medium" as const,
      category: "improvement",
    }));
    const urgentRisks = outlook.topRisks
      .filter((r) => r.severity === "high" || r.severity === "critical")
      .slice(0, 3);
    return [...taskLines, ...urgentRisks, ...improvement];
  }, [outlook, state.projects, state.tasks]);

  const labelStyles = OUTLOOK_LABEL_STYLES[outlook.overallOutlook];

  if (state.projects.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Octane Outlook"
          description="Strategic intelligence across your portfolio — rule-based, local-first."
        />
        <EmptyState
          icon={Telescope}
          title="No portfolio data yet"
          description="Outlook synthesizes projects, finance, agents, and holdings into a strategic view. Add projects or reset demo data in Settings."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 overflow-x-hidden pb-8">
      <PageHeader
        title="Octane Outlook"
        description={`Strategic intelligence for ${state.profile.name} · generated ${format(new Date(outlook.generatedAt), "MMM d, yyyy 'at' h:mm a")}`}
      />

      <OutlookSection
        title="Executive snapshot"
        description="Overall posture and score"
        icon={Telescope}
      >
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <p className={cn("text-4xl font-bold tabular-nums", labelStyles.text)}>
              {outlook.outlookScore}
            </p>
            <p className="text-sm text-zinc-500">Outlook score / 100</p>
          </div>
          <Badge variant="outline" className={cn("mt-1 capitalize", labelStyles.badge)}>
            {outlook.overallOutlook.replace("_", " ")}
          </Badge>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">{outlook.summary}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Execution"
            value={outlook.executionOutlook.score}
            subtitle={outlook.executionOutlook.label.replace("_", " ")}
            icon={Target}
          />
          <MetricCard
            title="Revenue"
            value={outlook.revenueOutlook.score}
            subtitle={outlook.revenueOutlook.label.replace("_", " ")}
            icon={DollarSign}
          />
          <MetricCard
            title="Agents"
            value={outlook.agentOutlook.score}
            subtitle={outlook.agentOutlook.label.replace("_", " ")}
            icon={Bot}
          />
          <MetricCard
            title="Holdings"
            value={outlook.holdingsOutlook.score}
            subtitle={outlook.holdingsOutlook.label.replace("_", " ")}
            icon={Landmark}
          />
        </div>
      </OutlookSection>

      <OutlookSection
        title="What needs attention"
        description="Critical tasks, urgent risks, and improvement gaps"
        icon={AlertCircle}
      >
        {attentionItems.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing urgent flagged"
            description="Tasks, risks, and improvement signals look manageable."
          />
        ) : (
          <InsightList
            items={attentionItems}
            emptyTitle="Nothing urgent"
            emptyDescription="All clear."
          />
        )}
      </OutlookSection>

      <OutlookSection
        title="Blockers"
        description="What is stopping progress today"
        icon={Zap}
      >
        <InsightList
          items={outlook.biggestBlockers}
          emptyTitle="No major blockers"
          emptyDescription="Clear runway on tasks and decisions."
        />
      </OutlookSection>

      <OutlookSection
        title="Opportunities"
        description="Bets and signals worth amplifying"
        icon={TrendingUp}
      >
        <InsightList
          items={outlook.topOpportunities}
          emptyTitle="No standout opportunities"
          emptyDescription="Stable ops — create momentum on high-progress projects."
        />
      </OutlookSection>

      <OutlookSection
        title="Risks"
        description="Issues that could derail the quarter"
        icon={AlertTriangle}
      >
        <InsightList
          items={outlook.topRisks}
          emptyTitle="No critical risks flagged"
          emptyDescription="Rule engine sees no high-severity portfolio risks right now."
        />
      </OutlookSection>

      <OutlookSection
        title="Recommended focus"
        description="Deterministic priority stack"
        icon={Target}
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-200">
          {outlook.recommendedFocus.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </OutlookSection>

      <OutlookSection
        title="30 / 60 / 90 day plan"
        description="Rule-based horizons — not financial or legal advice"
        icon={Telescope}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <PlanCard label="30 days" plan={outlook["30DayPlan"]} />
          <PlanCard label="60 days" plan={outlook["60DayPlan"]} />
          <PlanCard label="90 days" plan={outlook["90DayPlan"]} />
        </div>
      </OutlookSection>

      <OutlookSection
        title="Ask Octane"
        description="Executive questions answered from your portfolio — rule-based, local-first"
        icon={MessageCircleQuestion}
        id="ask-octane"
      >
        <AskOctanePanel />
      </OutlookSection>

      <details className="group rounded-xl border border-zinc-800/80 bg-zinc-900/30 open:ring-1 open:ring-zinc-700/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-zinc-200 [&::-webkit-details-marker]:hidden">
          <span>Detailed domain analysis</span>
          <ChevronDown className="size-4 text-zinc-500 transition group-open:rotate-180" />
        </summary>
        <div className="space-y-6 border-t border-zinc-800/80 px-4 py-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <OutlookSection
              title="What changed"
              description="Week-over-week signals"
              icon={Sparkles}
            >
              <ul className="space-y-2 text-sm text-zinc-300">
                {outlook.whatChanged.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </OutlookSection>
            <OutlookSection
              title="What is working"
              description="Strengths to protect"
              icon={CheckCircle2}
            >
              <ul className="space-y-2 text-sm text-zinc-300">
                {outlook.whatIsWorking.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 px-3 py-2"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </OutlookSection>
            <OutlookSection
              title="Signals to improve"
              description="Gaps surfaced in domain rules"
              icon={Clock}
            >
              <ul className="space-y-2 text-sm text-zinc-300">
                {outlook.whatNeedsImprovement.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border border-amber-900/30 bg-amber-950/10 px-3 py-2"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </OutlookSection>
          </div>

          <section>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Domain outlook
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <DomainCard
                title="Revenue outlook"
                domain={outlook.revenueOutlook}
                icon={DollarSign}
              />
              <DomainCard
                title="Execution outlook"
                domain={outlook.executionOutlook}
                icon={Target}
              />
              <DomainCard
                title="Agent outlook"
                domain={outlook.agentOutlook}
                icon={Bot}
              />
              <DomainCard
                title="Holdings outlook"
                domain={outlook.holdingsOutlook}
                icon={Landmark}
              />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <OutlookSection
              title="Projects to double down"
              description="High momentum, high priority"
              icon={TrendingUp}
            >
              {outlook.projectsToDoubleDown.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No double-down picks"
                  description="Advance active projects past 50% with no blockers to appear here."
                />
              ) : (
                <ul className="space-y-2">
                  {outlook.projectsToDoubleDown.map((p) => (
                    <li
                      key={p.projectId}
                      className="rounded-lg border border-emerald-900/30 bg-emerald-950/10 px-3 py-2 text-sm"
                    >
                      <Link
                        href="/projects"
                        className="font-medium text-zinc-100 hover:text-amber-300"
                      >
                        {p.projectName}
                      </Link>
                      <p className="mt-1 text-xs text-zinc-500">{p.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </OutlookSection>

            <OutlookSection
              title="Projects to pause or review"
              description="Stale, paused, or low ROI"
              icon={PauseCircle}
            >
              {outlook.projectsToPauseOrReview.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No review candidates"
                  description="Portfolio bets look intentionally maintained."
                />
              ) : (
                <ul className="space-y-2">
                  {outlook.projectsToPauseOrReview.map((p) => (
                    <li
                      key={p.projectId}
                      className="rounded-lg border border-zinc-800/90 bg-zinc-950/40 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-zinc-100">{p.projectName}</span>
                      <p className="mt-1 text-xs text-zinc-500">{p.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </OutlookSection>
          </div>

          <OutlookSection
            title="Advisor summary"
            description="Rule-based insights — not legal, tax, or investment advice"
            icon={Sparkles}
          >
            <p className="mb-4 text-xs text-zinc-500">
              No dedicated AI advisor API is configured. Use the rule-based Octane Advisor
              below, or open{" "}
              <Link href="/chat" className="text-amber-400/90 hover:underline">
                Octane AI
              </Link>{" "}
              with your API key for narrative summaries.
            </p>
            <OctaneAdvisorPanel context="briefing" />
          </OutlookSection>
        </div>
      </details>

      <Card className="border-zinc-800/60 bg-zinc-950/50">
        <CardContent className="py-4">
          <p className="text-xs leading-relaxed text-zinc-600">
            <strong className="text-zinc-500">Disclaimer:</strong> Octane Outlook is a
            deterministic, local-first synthesis of your workspace data. Scores, plans,
            and recommendations are heuristics for founder planning only — not legal,
            tax, investment, or compliance advice. Verify all entity, financial, and
            regulatory decisions with qualified professionals before acting.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
