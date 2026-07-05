import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-opus-4-8";

interface BriefSignal {
  title: string;
  severity: string;
  source: string;
  recommendedAction?: string;
}

interface BriefInput {
  companyContext?: string;
  score?: number;
  scorePenalty?: number;
  cash?: {
    monthlyRevenue?: number;
    monthlyExpenses?: number;
    runwayMonths?: number | null;
  };
  totals?: {
    invested?: number;
    made?: number;
    spent?: number;
    netPosition?: number;
    recurringMonthly?: number;
  };
  priorities?: string[];
  topThreeMoves?: string[];
  moneyWatch?: string[];
  decisionsDue?: string[];
  decisions?: {
    title: string;
    category: string;
    status: string;
    finalDecision?: string;
    reasoning?: string;
    expectedOutcome?: string;
  }[];
  signals?: BriefSignal[];
  projects?: { name: string; status: string }[];
}

const SYSTEM = `You are Octane — Logan's AI chief of staff and CEO co-pilot for his solo software portfolio (Octane Core, Octane Ajax, Octane Nexus, HedgeFund). The founder's Company Context (vision, each business, strategy, and the PRIORITIZATION FRAMEWORK) is your source of truth — ground the brief in it, and follow the framework's ranking when you decide what matters. You also get a sample of his Decision Log — keep your call consistent with how Logan actually decides, and cite a past decision as precedent when it fits.

Your #1 job: tell Logan THE ONE PLAY that matters most right now, and — when the data supports it — what to STOP or defer. Be opinionated. He spreads himself thin (especially polishing Core, which is comfortable) while Ajax, the revenue engine, sits at $0. Protect his focus. Revenue beats infrastructure; a real sale beats another feature.

You get TODAY'S REAL state as JSON. Write a tight, decisive brief — a sharp operator, not a chatbot. Use exactly these markdown headers:

**The play** — the single highest-leverage action right now. Name it concretely (project/repo/step) and give the one-line why. This is the headline; make it a real call, not a menu.
**Where things stand** — one punchy line on overall state (score, money, momentum).
**Watch** — 2 to 4 short bullets: the real risks and openings from the data.
**Stop / defer** — one line naming what NOT to spend time on right now, to protect focus. Omit only if nothing qualifies.

Rules: Be direct and specific. Cite the real numbers, repos, and signals from the input. Never invent data not in the input. No hedging, no filler, no "as an AI." Under ~180 words. If the data is genuinely sparse, the play is what to set up so Octane can guide him — but still make one clear call.`;

function currency(n: number | undefined): string {
  if (typeof n !== "number") return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** Deterministic brief when Anthropic is unavailable or errors. */
function ruleBasedBrief(input: BriefInput): string {
  const lines: string[] = [];
  const score = input.score ?? 0;
  const penaltyNote =
    input.scorePenalty && input.scorePenalty > 0
      ? ` (−${input.scorePenalty} from open risks)`
      : "";

  const play =
    input.topThreeMoves?.[0] ??
    input.priorities?.[0] ??
    "Get Octane Ajax to its first real sale — connect a live channel and push a product through the Review Gate.";
  lines.push("**The play**");
  lines.push(play);
  lines.push("");

  lines.push("**Where things stand**");
  lines.push(`Octane score ${score}${penaltyNote}.`);
  lines.push("");

  const watch: string[] = [];
  for (const s of (input.signals ?? []).slice(0, 4)) {
    watch.push(`- ${s.title}${s.recommendedAction ? ` → ${s.recommendedAction}` : ""}`);
  }
  for (const m of (input.moneyWatch ?? []).slice(0, 2)) watch.push(`- ${m}`);
  if (watch.length === 0) watch.push("- No active risks flagged — momentum is the priority.");
  lines.push("**Watch**");
  lines.push(...watch);
  lines.push("");

  lines.push("**Stop / defer**");
  const rev = input.cash?.monthlyRevenue ?? 0;
  const exp = input.cash?.monthlyExpenses ?? 0;
  if (exp > rev && rev === 0) {
    lines.push(
      `Anything that isn't Ajax revenue. Burn is ${currency(exp)}/mo against $0 in — don't add Core/Nexus scope until a sale lands.`,
    );
  } else if (input.topThreeMoves && input.topThreeMoves[1]) {
    lines.push(`Hold off on: ${input.topThreeMoves[1].toLowerCase()} — after the play, not before.`);
  } else {
    lines.push("Core polish and Nexus features — park them until Ajax has revenue.");
  }

  return lines.join("\n");
}

/** Canonical repos, ordered by strategic priority (Ajax first). */
const CANONICAL_REPOS: { repo: string; label: string }[] = [
  { repo: "NonstopAgent/Octane_Ajax", label: "Ajax (revenue engine, $0 so far)" },
  { repo: "NonstopAgent/Octane", label: "Core (this app)" },
  { repo: "NonstopAgent/Octane_Nexus", label: "Nexus" },
  { repo: "NonstopAgent/HedgeFund", label: "HedgeFund" },
];

/**
 * Where did Logan's effort go this week? Commit counts per repo (last 7d),
 * best-effort — lets the brief catch "heads-down on Core while Ajax sits idle."
 */
async function fetchRecentEffort(): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return "";
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "OctaneCore/1.0",
    Authorization: `Bearer ${token}`,
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const results = await Promise.allSettled(
      CANONICAL_REPOS.map(async ({ repo, label }) => {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/commits?since=${since}&per_page=40`,
          { headers, signal: ctrl.signal },
        );
        if (!res.ok) return `${label}: activity unknown`;
        const commits = (await res.json()) as unknown[];
        const n = Array.isArray(commits) ? commits.length : 0;
        return `${label}: ${n} commit${n === 1 ? "" : "s"} in last 7d`;
      }),
    );
    const lines = results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((v): v is string => Boolean(v));
    if (lines.length === 0) return "";
    return `RECENT EFFORT (commits per repo, last 7 days — use this to catch where Logan's time is going vs. where revenue is; Ajax at $0 means Core-heavy weeks are a red flag):\n${lines
      .map((l) => `- ${l}`)
      .join("\n")}\n`;
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  let input: BriefInput = {};
  try {
    input = (await request.json()) as BriefInput;
  } catch {
    input = {};
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ brief: ruleBasedBrief(input), source: "rule-based" });
  }

  try {
    const { companyContext, ...rest } = input;
    const effort = await fetchRecentEffort();
    const userContent = [
      companyContext?.trim()
        ? `COMPANY CONTEXT (source of truth):\n${companyContext.trim()}\n`
        : "",
      effort,
      `TODAY'S REAL STATE (JSON):\n${JSON.stringify(rest)}`,
      "\nWrite the brief.",
    ]
      .filter(Boolean)
      .join("\n");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!text) {
      return NextResponse.json({ brief: ruleBasedBrief(input), source: "rule-based" });
    }
    return NextResponse.json({ brief: text, source: "anthropic" });
  } catch {
    return NextResponse.json({ brief: ruleBasedBrief(input), source: "rule-based" });
  }
}
