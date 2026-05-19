"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";
import {
  generateAdvice,
  type AdvisorInsight,
} from "@/lib/advisor/generate-advice";

type Priority = AdvisorInsight["priority"];

const priorityClass: Record<Priority, string> = {
  critical: "border-red-800/60 bg-red-950/40 text-red-200",
  high: "border-amber-800/60 bg-amber-950/40 text-amber-200",
  medium: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
  low: "border-zinc-800 bg-zinc-950/40 text-zinc-400",
};

const priorityBadgeClass: Record<Priority, string> = {
  critical: "border-red-700 text-red-300",
  high: "border-amber-700 text-amber-300",
  medium: "border-zinc-600 text-zinc-400",
  low: "border-zinc-700 text-zinc-500",
};

export function OctaneAdvisorPanel({ context: _context }: { context?: string }) {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));
  const advice = useMemo(() => generateAdvice(state), [state]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-amber-400" aria-hidden />
          <p className="font-semibold text-zinc-100">{advice.headline}</p>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Rule-based insights from your local data. No AI calls.
        </p>
      </div>

      {advice.insights.length === 0 ? (
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-4 py-3">
          <p className="text-sm text-emerald-300">
            Everything looks on track. No urgent items detected.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {advice.insights.map((insight) => (
            <li
              key={insight.id}
              className={`rounded-lg border px-3 py-3 ${priorityClass[insight.priority]}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug">{insight.title}</p>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs capitalize ${priorityBadgeClass[insight.priority]}`}
                >
                  {insight.priority}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed opacity-80">{insight.body}</p>
              {insight.actionHref ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto gap-1 p-0 text-xs opacity-70 hover:opacity-100"
                  render={<Link href={insight.actionHref} />}
                >
                  <ExternalLink className="size-3" />
                  {insight.action}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {advice.suggestedPrompts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Suggested questions
          </p>
          <ul className="space-y-1">
            {advice.suggestedPrompts.map((prompt) => (
              <li
                key={prompt}
                className="rounded border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-xs text-zinc-400"
              >
                {prompt}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
