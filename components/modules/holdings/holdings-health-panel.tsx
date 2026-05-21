"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";

import type { OctanePersistedState } from "@/lib/store/octane-store";
import { computeHoldingsHealth } from "@/lib/scoring/holdings-health";

import { HoldingsSection } from "./holdings-section";

const BREAKDOWN_LABELS: Record<string, string> = {
  entityStructure: "Entity structure",
  ipOwnership: "IP ownership",
  documentCompliance: "Document compliance",
  calendarCompliance: "Compliance calendar",
  legalQuestions: "Legal questions",
  formationProgress: "Formation progress",
  baseScore: "Base score",
  operationalPenalty: "Ops penalty",
};

export function HoldingsHealthPanel({
  state,
}: {
  state: OctanePersistedState;
}) {
  const health = useMemo(() => computeHoldingsHealth(state), [state]);

  return (
    <HoldingsSection
      title="Health score"
      description="Rule-based organizer score — not legal or financial advice."
      icon={Sparkles}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="space-y-2 text-sm">
          {Object.entries(health.breakdown).map(([key, value]) => (
            <li
              key={key}
              className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2"
            >
              <span className="text-zinc-400">
                {BREAKDOWN_LABELS[key] ?? key}
              </span>
              <span className="font-medium text-zinc-100">{value}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Suggestions
          </p>
          {health.suggestions.length === 0 ? (
            <p className="text-sm text-zinc-500">No suggestions right now.</p>
          ) : (
            <ul className="list-inside list-disc space-y-1 text-sm text-zinc-300">
              {health.suggestions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </HoldingsSection>
  );
}
