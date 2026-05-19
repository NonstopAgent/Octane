import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  context: OctaneContext;
}

interface OctaneContext {
  projects?: { name: string; status: string; priority: string; progress: number }[];
  tasks?: { title: string; status: string; priority: string; projectName: string }[];
  agents?: { name: string; status: string; purpose: string }[];
  entities?: { name: string; type: string; status: string; tagline?: string }[];
  transactions?: { type: string; amount: number; description: string; date: string }[];
  decisions?: { title: string; status: string; category: string; summary: string }[];
  profile?: { name: string; role: string };
  activeEntityFilter?: string;
}

function buildSystemPrompt(ctx: OctaneContext): string {
  const lines: string[] = [
    "You are Octane AI — the intelligence layer of Octane Core, a founder operating system for Octane Holdings Trust and its portfolio companies.",
    "",
    "You have real-time awareness of the founder's data across all entities: Octane Ajax, Octane Nexus, Octane Labs, Octane Capital Lab, and Octane Holdings Trust.",
    "",
    "Your job: give sharp, actionable, senior-advisor-level responses. No fluff. Think like a COO, CFO, and CTO combined. Be direct and specific.",
    "",
  ];

  if (ctx.profile) {
    lines.push(`FOUNDER: ${ctx.profile.name} (${ctx.profile.role})`);
    lines.push("");
  }

  if (ctx.entities?.length) {
    lines.push("## ENTITIES IN THE PORTFOLIO");
    ctx.entities.forEach((e) => {
      lines.push(`- ${e.name} [${e.type}] (${e.status}): ${e.tagline ?? ""}`);
    });
    lines.push("");
  }

  if (ctx.projects?.length) {
    lines.push("## ACTIVE PROJECTS");
    ctx.projects.forEach((p) => {
      lines.push(
        `- ${p.name}: status=${p.status}, priority=${p.priority}, progress=${p.progress}%`,
      );
    });
    lines.push("");
  }

  if (ctx.tasks?.length) {
    const openTasks = ctx.tasks.filter((t) => t.status !== "done" && t.status !== "completed");
    lines.push(`## OPEN TASKS (${openTasks.length} total)`);
    openTasks.slice(0, 20).forEach((t) => {
      lines.push(
        `- [${t.priority.toUpperCase()}] ${t.title} (${t.status}) — ${t.projectName}`,
      );
    });
    lines.push("");
  }

  if (ctx.agents?.length) {
    lines.push("## AI AGENTS");
    ctx.agents.forEach((a) => {
      lines.push(`- ${a.name} [${a.status}]: ${a.purpose}`);
    });
    lines.push("");
  }

  if (ctx.transactions?.length) {
    const totalRevenue = ctx.transactions
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const totalExpenses = ctx.transactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    lines.push("## FINANCES");
    lines.push(`- Revenue (all time): $${totalRevenue.toLocaleString()}`);
    lines.push(`- Expenses (all time): $${totalExpenses.toLocaleString()}`);
    lines.push(`- Net: $${(totalRevenue - totalExpenses).toLocaleString()}`);
    lines.push("");
  }

  if (ctx.decisions?.length) {
    const active = ctx.decisions.filter((d) => d.status === "active");
    lines.push(`## ACTIVE DECISIONS (${active.length})`);
    active.slice(0, 10).forEach((d) => {
      lines.push(`- [${d.category}] ${d.title}: ${d.summary}`);
    });
    lines.push("");
  }

  if (ctx.activeEntityFilter) {
    lines.push(`The user is currently focused on: ${ctx.activeEntityFilter}`);
    lines.push("");
  }

  lines.push("Respond in plain, structured prose. Use bullet points only when listing multiple items. Never add disclaimers or hedge unnecessarily. You are advising, not covering yourself legally.");

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: "ANTHROPIC_API_KEY not configured. Add it to your environment variables.",
        setup: true,
      },
      { status: 503 },
    );
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { messages, context } = body;
  if (!messages?.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(context ?? {});

  try {
    const stream = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
