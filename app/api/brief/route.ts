import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-opus-4-6";

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
  signals?: BriefSignal[];
  projects?: { name: string; status: string }[];
}

const SYSTEM = `You are Octane — a solo founder's AI chief of staff and CEO co-pilot. The founder (Logan) runs a small software portfolio: Octane Core (the command-center app), Octane Ajax, and Octane Nexus. You are given the founder's Company Context (the vision, each business, strategy, and future plans) — treat it as the source of truth about the business and ground the brief in it.

You are given TODAY'S REAL state as JSON. Write a tight, forward-looking daily brief that reads like a sharp operator, not a chatbot. Use this exact structure with these markdown headers:

**Where things stand** — one punchy line.
**Focus today** — the single most important thing to do and why (be specific, name the project/repo).
**Watch** — 2 to 4 short bullets: real risks and opportunities from the data.
**What I'd do** — one concrete, forward-looking recommendation or decision.

Rules: Be direct and specific. Cite the real numbers, repos, and signals from the input. Never invent data that isn't in the input. No hedging, no filler, no "as an AI". Keep it under 180 words total. If the data is sparse, say what to set up next to make Octane more useful.`;

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
  lines.push("**Where things stand**");
  lines.push(`Octane score ${score}${penaltyNote}.`);
  lines.push("");

  const focus =
    input.topThreeMoves?.[0] ?? input.priorities?.[0] ?? "Ship the next milestone.";
  lines.push("**Focus today**");
  lines.push(focus);
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

  lines.push("**What I'd do**");
  const rev = input.cash?.monthlyRevenue ?? 0;
  const exp = input.cash?.monthlyExpenses ?? 0;
  if (input.decisionsDue && input.decisionsDue.length > 0) {
    lines.push(`Resolve the open decision: ${input.decisionsDue[0]}.`);
  } else if (exp > rev) {
    lines.push(
      `Burn (${currency(exp)}/mo) is above revenue (${currency(rev)}/mo) — either land revenue on Ajax or cut a recurring cost this week.`,
    );
  } else if (input.topThreeMoves && input.topThreeMoves[1]) {
    lines.push(`After the focus item, ${input.topThreeMoves[1].toLowerCase()}`);
  } else {
    lines.push("Pick the one bet with the clearest path to revenue and push it forward.");
  }

  return lines.join("\n");
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
    const userContent = [
      companyContext?.trim()
        ? `COMPANY CONTEXT (source of truth):\n${companyContext.trim()}\n`
        : "",
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
