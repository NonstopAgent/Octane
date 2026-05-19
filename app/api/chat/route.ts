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
      if (!token) {
        return "Cannot create issue: GITHUB_TOKEN is not set. Add it to your Vercel environment variables.";
      }
      const { repo, title, body, labels } = input as {
        repo: string;
        title: string;
        body: string;
        labels?: string[];
      };
      const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, labels: labels ?? [] }),
      });
      if (!res.ok) {
        const err = await res.text();
        return `Error creating issue: ${res.status} — ${err}`;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created = (await res.json()) as any;
      return `Issue created: #${created.number} "${created.title}"\nURL: ${created.html_url}`;
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
    "Logan runs two main products, both in active development:",
    "",
    "**Octane Ajax** (`NonstopAgent/Octane-Ajax`)",
    "An AI-powered platform. Logan is the sole developer. Status: active development.",
    "",
    "**Octane Nexus** (`NonstopAgent/Octane-Nexus`)",
    "A complementary product in the Octane ecosystem. Status: active development.",
    "",
    "**Octane Core** (this app) — the founder OS you're running inside. It tracks tasks, projects, finances, decisions, and gives Logan a unified command center over the portfolio.",
    "",
    "## WHAT YOU CAN DO",
    "Beyond answering questions, you have real tools to act on the repos:",
    "- `list_github_issues` — see open bugs/features on Ajax or Nexus",
    "- `list_github_prs` — see what PRs are open",
    "- `create_github_issue` — log a bug or feature request directly to GitHub",
    "- `get_repo_status` — get a snapshot of a repo's current state",
    "",
    "When Logan asks you to check a repo, act on an issue, or create something — use these tools. Don't ask for permission, just do it and report back.",
    "",
    "## LOGAN'S GOALS",
    "1. Make Ajax and Nexus products that run largely autonomously with minimal manual work",
    "2. The AI layer (you) should be able to monitor and act — not just report",
    "3. The app needs to feel real and operational, not full of placeholder data",
    "4. Single-user focus: Logan is the only user, so optimize for speed and directness",
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
