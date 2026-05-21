import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

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

/** Structured answer from lib/executive — summarized only, no tools or mutations. */
export interface ExecutiveSummaryRequest {
  mode: "executive_summary";
  executiveAnswer: Record<string, unknown>;
}

type PostBody = ChatRequest | ExecutiveSummaryRequest;

function isExecutiveSummaryRequest(body: PostBody): body is ExecutiveSummaryRequest {
  return "mode" in body && body.mode === "executive_summary";
}

interface OctaneContext {
  projects?: { name: string; status: string; priority: string; progress: number }[];
  tasks?: { title: string; status: string; priority: string; projectName: string }[];
  agents?: { name: string; status: string; purpose: string }[];
  entities?: { name: string; type: string; status: string; tagline?: string }[];
  transactions?: { type: string; amount: number; description: string; date: string }[];
  decisions?: { title: string; status: string; category: string; summary: string }[];
  signals?: {
    title: string;
    summary: string;
    severity: string;
    source: string;
    type: string;
    isLive?: boolean;
    isDerived?: boolean;
  }[];
  profile?: { name: string; role: string };
  activeEntityFilter?: string;
  workspaceDataMode?: {
    mode: "demo_seed" | "real_workspace" | "mixed";
    label: string;
    description: string;
  };
  gmailProvenance?: "live" | "mock" | null;
}

// ─── GitHub Tool Definitions ─────────────────────────────────────────────────

const GITHUB_TOOLS: Anthropic.Tool[] = [
  {
    name: "list_github_issues",
    description:
      "List open GitHub issues for a repository. Use this when the user asks about issues, bugs, or open problems in Ajax or Nexus. The repos are NonstopAgent/Octane-Ajax and NonstopAgent/Octane-Nexus.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository in owner/name format, e.g. NonstopAgent/Octane-Ajax",
        },
        state: {
          type: "string",
          enum: ["open", "closed", "all"],
          description: "Issue state filter. Default: open",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "list_github_prs",
    description:
      "List open pull requests for a repository. Use this when the user asks about pending PRs, code reviews, or what's in flight in a repo.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository in owner/name format",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "create_github_issue",
    description:
      "Create a new GitHub issue in Ajax or Nexus. Use this when the user wants to log a bug, create a task, or capture something that needs to be worked on. Always confirm the title and body before creating.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository in owner/name format, e.g. NonstopAgent/Octane-Ajax",
        },
        title: {
          type: "string",
          description: "Issue title — clear, action-oriented",
        },
        body: {
          type: "string",
          description: "Issue body in Markdown. Include context, steps to reproduce if a bug, or acceptance criteria if a feature.",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Optional labels like ['bug', 'enhancement', 'documentation']",
        },
      },
      required: ["repo", "title", "body"],
    },
  },
  {
    name: "get_repo_status",
    description:
      "Get the current status of a GitHub repository — last commit, open PRs count, open issues count, language, and recent activity. Use this when the user asks for a status check or overview of Ajax or Nexus.",
    input_schema: {
      type: "object" as const,
      properties: {
        repo: {
          type: "string",
          description: "Repository in owner/name format",
        },
      },
      required: ["repo"],
    },
  },
];

// ─── GitHub Tool Execution ────────────────────────────────────────────────────

async function executeGitHubTool(
  toolName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>,
): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "OctaneCore/1.0",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    if (toolName === "list_github_issues") {
      const { repo, state = "open" } = input as { repo: string; state?: string };
      const res = await fetch(
        `https://api.github.com/repos/${repo}/issues?state=${state}&per_page=20&sort=updated`,
        { headers },
      );
      if (!res.ok) return `Error fetching issues: ${res.status} ${res.statusText}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await res.json()) as any[];
      // Filter out PRs (GitHub issues endpoint returns both)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const issues = data.filter((i: any) => !i.pull_request);
      if (issues.length === 0) return `No ${state} issues found in ${repo}.`;
      return issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((i: any) =>
          `#${i.number} [${i.state}] ${i.title}\n  Labels: ${i.labels.map((l: { name: string }) => l.name).join(", ") || "none"}\n  URL: ${i.html_url}`,
        )
        .join("\n\n");
    }

    if (toolName === "list_github_prs") {
      const { repo } = input as { repo: string };
      const res = await fetch(
        `https://api.github.com/repos/${repo}/pulls?state=open&per_page=10&sort=updated`,
        { headers },
      );
      if (!res.ok) return `Error fetching PRs: ${res.status} ${res.statusText}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prs = (await res.json()) as any[];
      if (prs.length === 0) return `No open PRs in ${repo}.`;
      return prs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((pr: any) =>
          `PR #${pr.number}: ${pr.title}\n  Author: ${pr.user.login} | Base: ${pr.base.ref} ← ${pr.head.ref}\n  URL: ${pr.html_url}`,
        )
        .join("\n\n");
    }

    if (toolName === "create_github_issue") {
      const { repo, title, body } = input as {
        repo: string;
        title: string;
        body: string;
      };
      return [
        "GitHub issues are not created automatically.",
        `Proposed: "${title}" in ${repo}.`,
        "Ask the user to approve the matching action on /actions (or rephrase in Chat to trigger an Octane action proposal).",
        `Draft body:\n${body}`,
      ].join("\n");
    }

    if (toolName === "get_repo_status") {
      const { repo } = input as { repo: string };
      const [repoRes, commitsRes, prsRes] = await Promise.allSettled([
        fetch(`https://api.github.com/repos/${repo}`, { headers }),
        fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, { headers }),
        fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=5`, { headers }),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const repoData: any =
        repoRes.status === "fulfilled" && repoRes.value.ok
          ? await repoRes.value.json()
          : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const commits: any[] =
        commitsRes.status === "fulfilled" && commitsRes.value.ok
          ? await commitsRes.value.json()
          : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prs: any[] =
        prsRes.status === "fulfilled" && prsRes.value.ok
          ? await prsRes.value.json()
          : [];

      if (!repoData) return `Could not fetch repo data for ${repo}.`;

      const lastCommit = commits[0]
        ? `${commits[0].sha.slice(0, 7)} — "${commits[0].commit.message.split("\n")[0]}" by ${commits[0].commit.author.name} (${new Date(commits[0].commit.author.date).toLocaleDateString()})`
        : "No commits found";

      return [
        `Repo: ${repoData.full_name} [${repoData.visibility}]`,
        `Description: ${repoData.description ?? "none"}`,
        `Language: ${repoData.language ?? "unknown"} | Stars: ${repoData.stargazers_count} | Forks: ${repoData.forks_count}`,
        `Open issues: ${repoData.open_issues_count} | Open PRs: ${prs.length}`,
        `Last push: ${new Date(repoData.pushed_at).toLocaleDateString()}`,
        `Last commit: ${lastCommit}`,
        prs.length > 0 ? `Open PRs: ${prs.map((p: { number: number; title: string }) => `#${p.number} ${p.title}`).join(", ")}` : "No open PRs",
      ].join("\n");
    }

    return `Unknown tool: ${toolName}`;
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: OctaneContext): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines: string[] = [
    `You are Octane AI — the operating intelligence for ${ctx.profile?.name ?? "Logan"}'s company, Octane Holdings Trust, and its portfolio of software products.`,
    "",
    `Today is ${today}.`,
    "",
    "## WHO YOU ARE",
    "You combine the judgment of a senior CTO, COO, and strategic advisor. You know everything about the portfolio — code repos, tasks, projects, finances, decisions, and agents. You don't hedge, you don't add disclaimers, and you never say 'I'm just an AI.' You give direct, specific, actionable advice.",
    "",
    "## THE PORTFOLIO",
    "Logan runs two main products under Octane Holdings Trust:",
    "",
    "**Octane Ajax** (repo: `NonstopAgent/Octane-Ajax`, live: octane-ajax-lzu6au72b-nonstopagents-projects.vercel.app)",
    "Autonomous product engine: research → compilation → asset placement. Three AI agents run the pipeline:",
    "- Nova (Research): mines demand signals, competitor intel, and product ideas from market data",
    "- Forge (Creation): compiles digital products (PDFs, guides, kits) from approved concepts",
    "- Pixel (Marketing): generates promo copy and placement assets for distribution channels",
    "Pipeline: Research Lab → Design Press → Review Gate (Logan approves/rejects) → Media Studio → Storefront",
    "Sales channels: Etsy (OAuth not yet connected), Lemon Squeezy (API key not set), Gumroad",
    "Current status: pipeline operational, agents idle, Etsy shop being set up, first product at $9.99 in review",
    "Key gaps: Etsy not connected, no revenue flowing yet, product model needs evaluation vs. higher-LTV formats",
    "Logan's direction: Nova should out-research competitors; Forge/Pixel should run autonomously after review gate.",
    "",
    "**Octane Nexus** (repo: `NonstopAgent/Octane-Nexus`)",
    "External data and media indexing layer — ingests, normalizes, and surfaces third-party signals (research briefs, media feeds, partner content) for the portfolio. Complements Ajax's product factory with outward-facing intelligence.",
    "Status: active development; prioritize indexing quality and signal freshness over feature breadth.",
    "",
    "**Octane Core** (this app, repo: `NonstopAgent/Octane`) — the founder OS. Tracks tasks, projects, finances, decisions, agents, and the Universal Signal ledger. You run inside it. Logan uses it to manage and monitor Ajax, Nexus, and live integrations.",
    "",
    "## WHAT YOU CAN DO",
    "You have real tools — use them without being asked:",
    "- `list_github_issues` — check open bugs/features on Ajax or Nexus",
    "- `list_github_prs` — see what's in flight",
    "- `create_github_issue` — log bugs, features, or action items directly to GitHub",
    "- `get_repo_status` — snapshot of a repo right now",
    "",
    "When Logan asks about a repo or mentions a problem with Ajax/Nexus, use these tools immediately. Don't wait for permission. Report what you found and what you did.",
    "",
    "## WORKSPACE DATA MODE",
    ctx.workspaceDataMode
      ? `Current mode: **${ctx.workspaceDataMode.label}** (${ctx.workspaceDataMode.mode}). ${ctx.workspaceDataMode.description}`
      : "Workspace data mode unknown — treat portfolio metrics as user-owned unless clearly marked demo.",
    ctx.gmailProvenance === "mock"
      ? "Gmail connector is in **sandbox/simulated** mode (no GMAIL_ACCESS_TOKEN). Treat Gmail-class signals as illustrative until triaged and confirmed live."
      : ctx.gmailProvenance === "live"
        ? "Gmail connector is **live** — Gmail-sourced signals reflect real inbox metadata."
        : "",
    "",
    "## SIGNAL LEDGER (cross-reference when advising)",
    "When answering strategy, risk, or 'what should I do' questions, cross-reference the active Signal ledger in context:",
    "- The signals list reflects **current triage state** (resolved/dismissed items are excluded)",
    "- Prioritize **active developer blockers** (blocked tasks, Vercel deployment failures, Gmail security/build alerts) over stale backlog items",
    "- Treat critical/high **Gmail** and **Vercel** signals as immediate portfolio risks when live; downgrade urgency for sandbox Gmail (`isDerived` / mock provenance)",
    "- Finance-class Gmail signals (invoice, payment) tie to runway decisions; opportunity-class signals tie to Nexus/Ajax GTM",
    "- If signals conflict with task lists, trust fresher live connector signals (Gmail/Vercel) for operational urgency",
    "",
    "## LOGAN'S DIRECTION",
    "1. Ajax and Nexus should run themselves with minimal manual work from Logan",
    "2. Nova needs to research competitors and generate product ideas that will actually sell — not just generic PDFs",
    "3. Octane (this app) should be the control center: monitor, flag problems, and act on them",
    "4. No setup wizards, no fake data, no placeholder content — everything should be real or clearly empty",
    "5. Logan is the only user. Be direct, skip the preamble, and give specific actionable answers",
    "",
  ];

  if (ctx.entities?.length) {
    lines.push("## CURRENT ENTITIES");
    ctx.entities.forEach((e) => {
      lines.push(`- **${e.name}** [${e.type}] (${e.status})${e.tagline ? `: ${e.tagline}` : ""}`);
    });
    lines.push("");
  }

  if (ctx.projects?.length) {
    const active = ctx.projects.filter((p) => p.status !== "completed" && p.status !== "archived");
    if (active.length) {
      lines.push(`## ACTIVE PROJECTS (${active.length})`);
      active.forEach((p) => {
        lines.push(`- **${p.name}**: ${p.status}, ${p.priority} priority, ${p.progress}% complete`);
      });
      lines.push("");
    }
  }

  if (ctx.tasks?.length) {
    const critical = ctx.tasks.filter((t) => t.priority === "critical" && t.status !== "done");
    const blocked = ctx.tasks.filter((t) => t.status === "blocked");
    const open = ctx.tasks.filter((t) => t.status !== "done" && t.status !== "completed");

    lines.push(`## TASKS SNAPSHOT`);
    lines.push(`- Total open: ${open.length} | Critical: ${critical.length} | Blocked: ${blocked.length}`);

    if (critical.length > 0) {
      lines.push("\nCritical tasks:");
      critical.slice(0, 8).forEach((t) => {
        lines.push(`  - [CRITICAL] ${t.title} (${t.status}) — ${t.projectName}`);
      });
    }

    if (blocked.length > 0) {
      lines.push("\nBlocked tasks:");
      blocked.slice(0, 5).forEach((t) => {
        lines.push(`  - [BLOCKED] ${t.title} — ${t.projectName}`);
      });
    }

    const inProgress = open
      .filter((t) => t.status === "in_progress")
      .slice(0, 5);
    if (inProgress.length > 0) {
      lines.push("\nIn progress:");
      inProgress.forEach((t) => {
        lines.push(`  - ${t.title} (${t.priority}) — ${t.projectName}`);
      });
    }
    lines.push("");
  }

  if (ctx.agents?.length) {
    const running = ctx.agents.filter((a) => a.status === "running" || a.status === "active");
    lines.push(`## AI AGENTS (${ctx.agents.length} total, ${running.length} running)`);
    ctx.agents.forEach((a) => {
      lines.push(`- **${a.name}** [${a.status}]: ${a.purpose}`);
    });
    lines.push("");
  }

  if (ctx.transactions?.length) {
    const revenue = ctx.transactions
      .filter((t) => t.type === "income" || t.type === "revenue")
      .reduce((s, t) => s + t.amount, 0);
    const expenses = ctx.transactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    lines.push("## FINANCES");
    lines.push(`- Revenue: $${revenue.toLocaleString()} | Expenses: $${expenses.toLocaleString()} | Net: $${(revenue - expenses).toLocaleString()}`);
    lines.push("");
  }

  if (ctx.decisions?.length) {
    const pending = ctx.decisions.filter((d) => d.status === "pending" || d.status === "open" || d.status === "active");
    if (pending.length > 0) {
      lines.push(`## PENDING DECISIONS (${pending.length})`);
      pending.slice(0, 6).forEach((d) => {
        lines.push(`- [${d.category}] **${d.title}**: ${d.summary}`);
      });
      lines.push("");
    }
  }

  if (ctx.signals?.length) {
    const ORDER = ["critical", "high", "medium", "low"];
    const active = ctx.signals
      .filter((s) => ORDER.includes(s.severity))
      .sort(
        (a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity),
      )
      .slice(0, 10);
    if (active.length > 0) {
      lines.push("## LIVE SIGNAL LEDGER (top priority)");
      active.forEach((s) => {
        const provenance =
          s.source === "gmail" && s.isDerived
            ? "sandbox"
            : s.source === "gmail" && s.isLive
              ? "live"
              : s.source;
        lines.push(
          `- [${s.severity.toUpperCase()}] [${provenance}/${s.type}] ${s.title}: ${s.summary}`,
        );
      });
      lines.push("");
    }
  }

  if (ctx.activeEntityFilter) {
    lines.push(`> Currently focused on: **${ctx.activeEntityFilter}**`);
    lines.push("");
  }

  lines.push(
    "## RESPONSE STYLE",
    "- Be direct. No fluff, no 'great question', no qualifiers.",
    "- When you have the data, cite it specifically (task names, PR numbers, commit SHAs).",
    "- When action is possible (creating an issue, etc.), take it — don't just suggest it.",
    "- Keep responses focused. If the answer is 2 sentences, don't write a paragraph.",
    "- Use bullet points for lists, prose for analysis.",
  );

  return lines.join("\n");
}

const EXECUTIVE_SUMMARY_SYSTEM = `You write concise executive narrative summaries from structured portfolio answers.

Rules:
- Summarize ONLY the JSON executive answer provided. Do not invent facts, numbers, or entities not present in that JSON.
- Do not mutate data, execute actions, call tools, or recommend automated changes to systems.
- Do not request or reference API keys, tokens, environment variables, or other secrets.
- Keep the narrative to 2–4 short paragraphs (under ~200 words unless the answer is very large).
- Use clear, direct prose suitable for a founder briefing.

Disclaimer (include once, briefly, at the end): This summary is for planning and organizational purposes only. It is not legal, tax, investment, or professional advice. Consult qualified professionals before acting on holdings, finance, or compliance matters.`;

async function handleExecutiveSummary(
  executiveAnswer: Record<string, unknown>,
): Promise<NextResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY not configured. Add it to your Vercel environment variables to enable AI narrative summaries.",
        setup: true,
      },
      { status: 503 },
    );
  }

  let payload: string;
  try {
    payload = JSON.stringify(executiveAnswer);
  } catch {
    return NextResponse.json({ error: "Invalid executive answer" }, { status: 400 });
  }

  if (!payload || payload === "{}") {
    return NextResponse.json({ error: "executiveAnswer required" }, { status: 400 });
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: EXECUTIVE_SUMMARY_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Summarize this structured executive answer as a narrative briefing:\n\n${payload}`,
        },
      ],
    });

    const summary = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!summary) {
      return NextResponse.json({ error: "Empty summary from model" }, { status: 500 });
    }

    return NextResponse.json({ summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[chat] executive_summary error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Stream helper ────────────────────────────────────────────────────────────

function streamResponse(
  stream: AsyncIterable<Anthropic.RawMessageStreamEvent>,
): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (isExecutiveSummaryRequest(body)) {
    return handleExecutiveSummary(body.executiveAnswer ?? {});
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY not configured. Add it to your Vercel environment variables.",
        setup: true,
      },
      { status: 503 },
    );
  }

  const { messages, context } = body;
  if (!messages?.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(context ?? {});
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    // Phase 1: Non-streaming call with tools enabled to detect tool use
    const firstResponse = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools: GITHUB_TOOLS,
      messages: anthropicMessages,
    });

    // No tools needed — stream the text directly
    if (firstResponse.stop_reason !== "tool_use") {
      const text = firstResponse.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(text));
          controller.close();
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Tools were requested — execute them
    const toolUseBlocks = firstResponse.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const result = await executeGitHubTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
        );
        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: result,
        };
      }),
    );

    // Phase 2: Stream the final response with tool results injected
    const finalStream = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools: GITHUB_TOOLS,
      messages: [
        ...anthropicMessages,
        { role: "assistant", content: firstResponse.content },
        { role: "user", content: toolResults },
      ],
      stream: true,
    });

    return streamResponse(finalStream);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[chat] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
