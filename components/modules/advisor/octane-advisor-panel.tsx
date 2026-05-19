"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  Brain,
  ChevronRight,
  DollarSign,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  answerPrompt,
  generateAdvice,
  type AdvisorInsight,
} from "@/lib/advisor/generate-advice";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";

export interface OctaneAdvisorPanelProps {
  context?: "dashboard" | "briefing" | "project";
  projectId?: string;
}

const PRIORITY_STYLES: Record<
  AdvisorInsight["priority"],
  { badge: string; border: string; dot: string }
> = {
  critical: {
    badge: "border-amber-500/60 bg-amber-500/10 text-amber-300",
    border: "border-amber-800/60 bg-amber-950/20",
    dot: "bg-amber-400",
  },
  high: {
    badge: "border-orange-600/60 bg-orange-500/10 text-orange-300",
    border: "border-orange-900/50 bg-orange-950/15",
    dot: "bg-orange-400",
  },
  medium: {
    badge: "border-zinc-600/60 bg-zinc-800/60 text-zinc-300",
    border: "border-zinc-800/80 bg-zinc-900/30",
    dot: "bg-zinc-400",
  },
  low: {
    badge: "border-zinc-700/40 bg-zinc-900/40 text-zinc-500",
    border: "border-zinc-800/50 bg-zinc-950/30",
    dot: "bg-zinc-600",
  },
};

const CATEGORY_ICONS: Record<
  AdvisorInsight["category"],
  React.ComponentType<{ className?: string }>
> = {
  execution: Target,
  finance: DollarSign,
  ownership: Shield,
  decisions: Scale,
  agents: Bot,
  focus: Zap,
};

const CATEGORY_LABELS: Record<AdvisorInsight["category"], string> = {
  execution: "Execution",
  finance: "Finance",
  ownership: "Ownership",
  decisions: "Decisions",
  agents: "Agents",
  focus: "Focus",
};

function PriorityDot({ priority }: { priority: AdvisorInsight["priority"] }) {
  return (
    <span
      className={cn(
        "mt-1.5 size-1.5 shrink-0 rounded-full",
        PRIORITY_STYLES[priority].dot,
      )}
    />
  );
}

function InsightCard({ insight }: { insight: AdvisorInsight }) {
  const styles = PRIORITY_STYLES[insight.priority];
  const CategoryIcon = CATEGORY_ICONS[insight.category];

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        styles.border,
      )}
    >
      <div className="flex items-start gap-2.5">
        <PriorityDot priority={insight.priority} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
                styles.badge,
              )}
            >
              {insight.priority}
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-zinc-700/40 bg-zinc-900/40 px-1.5 py-0.5 text-[10px] text-zinc-500">
              <CategoryIcon className="size-2.5" aria-hidden />
              {CATEGORY_LABELS[insight.category]}
            </span>
          </div>
          <p className="text-sm font-medium text-zinc-100">{insight.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {insight.body}
          </p>
          {insight.action && insight.actionHref ? (
            <Link
              href={insight.actionHref}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-400/90 hover:text-amber-300 transition-colors"
            >
              {insight.action}
              <ChevronRight className="size-3" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PromptResponse({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-3">
      <div className="flex items-start gap-2">
        <Brain className="mt-0.5 size-3.5 shrink-0 text-amber-400/80" aria-hidden />
        <p className="text-xs leading-relaxed text-zinc-300">{text}</p>
      </div>
    </div>
  );
}

export function OctaneAdvisorPanel({
  context = "dashboard",
}: OctaneAdvisorPanelProps) {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));
  const [refreshKey, setRefreshKey] = useState(0);
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [promptResponse, setPromptResponse] = useState<string | null>(null);

  const advice = useMemo(
    () => generateAdvice(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, refreshKey],
  );

  function handleRefresh() {
    setRefreshKey((k) => k + 1);
    setActivePrompt(null);
    setPromptResponse(null);
  }

  function handlePromptClick(prompt: string) {
    if (activePrompt === prompt) {
      setActivePrompt(null);
      setPromptResponse(null);
      return;
    }
    const answer = answerPrompt(prompt, advice);
    setActivePrompt(prompt);
    setPromptResponse(answer);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-400" aria-hidden />
          <h2 className="text-sm font-semibold text-zinc-100">
            Octane Advisor
          </h2>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              context === "dashboard"
                ? "bg-zinc-800 text-zinc-400"
                : context === "briefing"
                  ? "bg-amber-950/40 text-amber-400/80"
                  : "bg-zinc-800 text-zinc-400",
            )}
          >
            {context}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          className="h-7 gap-1.5 px-2 text-xs text-zinc-500 hover:text-zinc-300"
        >
          <RefreshCw className="size-3" aria-hidden />
          Refresh analysis
        </Button>
      </div>

      {/* Headline */}
      <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={cn(
              "size-3.5 shrink-0",
              advice.insights.some((i) => i.priority === "critical")
                ? "text-amber-400"
                : advice.insights.some((i) => i.priority === "high")
                  ? "text-orange-400"
                  : "text-zinc-500",
            )}
            aria-hidden
          />
          <p className="text-sm text-zinc-200">{advice.headline}</p>
          {advice.insights.length > 0 ? (
            <Badge
              variant="outline"
              className="ml-auto border-zinc-700 bg-zinc-800/60 text-xs text-zinc-400"
            >
              {advice.insights.length} insight{advice.insights.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Suggested prompts */}
      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Ask the advisor
        </p>
        <div className="flex flex-wrap gap-1.5">
          {advice.suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handlePromptClick(prompt)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                activePrompt === prompt
                  ? "border-amber-600/60 bg-amber-950/30 text-amber-300"
                  : "border-zinc-700/60 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
              )}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt response */}
      {activePrompt && promptResponse ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Response
          </p>
          <PromptResponse text={promptResponse} />
        </div>
      ) : null}

      {/* Insights */}
      {advice.insights.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Insights
          </p>
          <div className="space-y-2">
            {advice.insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/20 p-4 text-center">
          <Sparkles
            className="mx-auto mb-2 size-5 text-zinc-600"
            aria-hidden
          />
          <p className="text-sm text-zinc-500">
            No issues detected across your portfolio.
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Keep shipping. Check back after new activity.
          </p>
        </div>
      )}
    </div>
  );
}
