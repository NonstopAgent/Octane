"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { generateMorningBriefing } from "@/lib/briefing/generate-briefing";
import {
  netPosition,
  recurringMonthly,
  totalExpensesAllTime,
  totalInvested,
  totalRevenue,
} from "@/lib/finance/metrics";
import { computeOctaneScore } from "@/lib/scoring/octane-score";
import {
  buildDisplaySignals,
  selectActiveSignals,
  selectWorkspaceForSignals,
} from "@/lib/signals/workspace-signals";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";

const CACHE_KEY = "octane-ceo-brief";
const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

type CachedBrief = { date: string; brief: string; source: string };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Minimal markdown-lite renderer for the brief (headers + bullets + paragraphs). */
function BriefBody({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-zinc-300">
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return <div key={i} className="h-1" />;
        const header = line.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
        if (header && !header[2]) {
          return (
            <p
              key={i}
              className="pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400/80"
            >
              {header[1]}
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <p key={i} className="flex gap-2 text-zinc-300">
              <span className="text-amber-500/70">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </p>
          );
        }
        return (
          <p key={i} className="text-zinc-300">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

/** Render **bold** spans inline. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <strong key={i} className="font-semibold text-zinc-100">
          {m[1]}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function CeoBrief() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));
  const workspace = useOctaneStore(useShallow(selectWorkspaceForSignals));
  const storedSignals = useOctaneStore((s) => s.signals);

  const [mounted, setMounted] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const summary = useMemo(() => {
    const briefing = generateMorningBriefing(state);
    const score = computeOctaneScore(state);
    const transactions = state.transactions ?? [];
    const active = selectActiveSignals(
      buildDisplaySignals(workspace, storedSignals),
    )
      .slice()
      .sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(a.severity) -
          SEVERITY_ORDER.indexOf(b.severity),
      )
      .slice(0, 12)
      .map((s) => ({
        title: s.title,
        severity: s.severity,
        source: s.source,
        recommendedAction: s.recommendedAction,
      }));
    return {
      score: score.score,
      scorePenalty: score.breakdown.operationalPenalty,
      cash: briefing.cashSnapshot,
      totals: {
        invested: totalInvested(transactions),
        made: totalRevenue(transactions),
        spent: totalExpensesAllTime(transactions),
        netPosition: netPosition(transactions),
        recurringMonthly: recurringMonthly(transactions),
      },
      priorities: briefing.topPriorities,
      topThreeMoves: briefing.topThreeMoves,
      moneyWatch: briefing.moneyWatch,
      decisionsDue: briefing.decisionQueue.map((d) => d.decision.title),
      signals: active,
      projects: (state.projects ?? []).map((p) => ({
        name: p.name,
        status: p.status,
      })),
    };
  }, [state, workspace, storedSignals]);

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      });
      const data = (await res.json()) as { brief?: string; source?: string };
      if (data.brief) {
        setBrief(data.brief);
        setSource(data.source ?? "");
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              date: todayKey(),
              brief: data.brief,
              source: data.source ?? "",
            } satisfies CachedBrief),
          );
        } catch {
          // ignore quota errors
        }
      }
    } finally {
      setLoading(false);
    }
  }, [summary]);

  useEffect(() => {
    setMounted(true);
    let cached: CachedBrief | null = null;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      cached = raw ? (JSON.parse(raw) as CachedBrief) : null;
    } catch {
      cached = null;
    }
    if (cached && cached.date === todayKey() && cached.brief) {
      setBrief(cached.brief);
      setSource(cached.source);
    } else {
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  return (
    <div className="rounded-xl border border-amber-900/30 bg-gradient-to-b from-amber-950/20 to-zinc-900/20 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium text-amber-100">
          <Sparkles className="size-4 text-amber-400" />
          Octane&apos;s read on today
        </h2>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-amber-400 disabled:opacity-50"
        >
          <RefreshCw className={loading ? "size-3 animate-spin" : "size-3"} />
          Refresh
        </button>
      </div>

      {loading && !brief ? (
        <div className="flex items-center gap-2 py-3 text-sm text-zinc-500">
          <Loader2 className="size-4 animate-spin" />
          Reading your repos, money, and open work…
        </div>
      ) : brief ? (
        <>
          <BriefBody text={brief} />
          {source === "rule-based" ? (
            <p className="mt-2 text-[10px] text-zinc-600">
              Rule-based brief (add ANTHROPIC_API_KEY for the AI-written version).
            </p>
          ) : null}
        </>
      ) : (
        <p className="py-3 text-sm text-zinc-500">
          No brief yet — hit Refresh to generate one from your live state.
        </p>
      )}
    </div>
  );
}
