"use client";

import {
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Bot, Send, Sparkles, Trash2, Zap } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { parseOctaneCommand } from "@/lib/actions/parse-octane-command";
import {
  buildDisplaySignals,
  selectActiveSignals,
  selectWorkspaceForSignals,
} from "@/lib/signals/workspace-signals";
import {
  selectOctanePersistedState,
  useOctaneStore,
} from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/app/api/chat/route";

const SUGGESTED_PROMPTS = [
  "What should I prioritize across Nexus and Ajax this week?",
  "Analyze my current burn rate and give me a 90-day runway estimate.",
  "Which agents are underperforming and what should I do about it?",
  "What decisions are overdue for review?",
  "Give me an honest assessment of where Octane Ajax is right now.",
  "What are the biggest risks across all my entities?",
  "How should I sequence the work across Core, Nexus, and Ajax?",
  "Summarize everything happening this week in one briefing.",
];

/** Render a single line of text — handles inline bold (**text**) and inline code (`code`) */
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Split on **bold** and `code` patterns
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-zinc-100">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={key++}
          className="rounded bg-zinc-800/80 px-1 py-0.5 font-mono text-[11px] text-amber-300/90"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/** Render assistant Markdown content into structured React nodes */
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`ul-${i}`} className="my-1.5 space-y-1 pl-4">
        {listItems.map((item, j) => (
          <li key={j} className="flex gap-2 text-zinc-300">
            <span className="mt-[5px] size-1 shrink-0 rounded-full bg-amber-400/70" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      flushList();
      nodes.push(<br key={`br-${i}`} />);
      i++;
      continue;
    }

    // H2/H3 heading
    if (line.startsWith("## ")) {
      flushList();
      nodes.push(
        <p key={`h2-${i}`} className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {line.slice(3)}
        </p>,
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      nodes.push(
        <p key={`h3-${i}`} className="mt-2 mb-0.5 text-sm font-semibold text-zinc-200">
          {line.slice(4)}
        </p>,
      );
      i++;
      continue;
    }

    // Numbered list item (1. text)
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      flushList();
      nodes.push(
        <div key={`ol-${i}`} className="flex gap-2 text-zinc-300">
          <span className="shrink-0 font-mono text-[11px] text-amber-400/70">{numberedMatch[1]}.</span>
          <span>{renderInline(numberedMatch[2])}</span>
        </div>,
      );
      i++;
      continue;
    }

    // Bullet list item
    if (line.match(/^[-*]\s+/)) {
      listItems.push(line.replace(/^[-*]\s+/, ""));
      i++;
      continue;
    }

    // Regular paragraph line
    flushList();
    nodes.push(
      <span key={`p-${i}`}>
        {renderInline(line)}
        {i < lines.length - 1 && lines[i + 1]?.trim() !== "" && <br />}
      </span>,
    );
    i++;
  }

  flushList();
  return <>{nodes}</>;
}

function ChatMessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs",
          isUser
            ? "bg-zinc-700 text-zinc-200"
            : "bg-amber-950/60 text-amber-400 border border-amber-800/40",
        )}
      >
        {isUser ? "L" : <Sparkles className="size-3.5" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-zinc-800 text-zinc-100"
            : "rounded-tl-sm bg-zinc-900/80 border border-zinc-800/80 text-zinc-200",
        )}
      >
        {isUser ? (
          message.content
        ) : (
          <MarkdownContent text={message.content} />
        )}
        {isStreaming && (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-amber-400" />
        )}
      </div>
    </div>
  );
}

function ApiSetupBanner() {
  return (
    <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-5">
      <div className="flex items-start gap-3">
        <Zap className="mt-0.5 size-5 shrink-0 text-amber-400" />
        <div>
          <p className="font-semibold text-amber-200">API key not configured</p>
          <p className="mt-1 text-sm text-amber-300/80">
            To activate Octane AI, add your Anthropic API key:
          </p>
          <ol className="mt-2 space-y-1 text-sm text-amber-200/70">
            <li>1. Go to <a href="https://console.anthropic.com" target="_blank" rel="noopener" className="underline hover:text-amber-200">console.anthropic.com</a> → API Keys</li>
            <li>2. Add <code className="rounded bg-amber-950/60 px-1.5 py-0.5 text-xs text-amber-300">ANTHROPIC_API_KEY</code> to your Vercel project env vars</li>
            <li>3. Redeploy — then come back here</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Loading…</p>}>
      <ChatPageContent />
    </Suspense>
  );
}

function ChatPageContent() {
  const state = useOctaneStore(useShallow(selectOctanePersistedState));
  const workspace = useOctaneStore(useShallow(selectWorkspaceForSignals));
  const storedSignals = useOctaneStore((s) => s.signals);
  const proposeOctaneActions = useOctaneStore((s) => s.proposeOctaneActions);
  const pendingCount = useOctaneStore(
    (s) => s.octaneActions.filter((a) => a.status === "proposed").length,
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Build context from store
  const context = useMemo(() => {
    const projects = state.projects.map((p) => ({
      name: p.name,
      status: p.status,
      priority: p.priority,
      progress: p.progress ?? 0,
    }));

    const taskProjectMap: Record<string, string> = {};
    state.projects.forEach((p) => {
      taskProjectMap[p.id] = p.name;
    });

    const tasks = state.tasks.map((t) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      projectName: taskProjectMap[t.projectId ?? ""] ?? "Unknown",
    }));

    const agents = state.agents.map((a) => ({
      name: a.name,
      status: a.status,
      purpose: a.purpose,
    }));

    const entities = state.entities.map((e) => ({
      name: e.name,
      type: e.type,
      status: e.status,
      tagline: e.tagline,
    }));

    const transactions = state.transactions.map((t) => ({
      type: t.type,
      amount: t.amount,
      description: t.notes ?? t.category ?? "",
      date: t.transactionDate,
    }));

    const decisions = state.decisions.map((d) => ({
      title: d.title,
      status: d.status,
      category: d.category,
      summary: d.summary,
    }));

    const signals = selectActiveSignals(
      buildDisplaySignals(workspace, storedSignals),
    )
      .filter((s) => s.severity === "critical" || s.severity === "high")
      .slice(0, 12)
      .map((s) => ({
        title: s.title,
        summary: s.summary,
        severity: s.severity,
        source: s.source,
        type: s.type,
      }));

    return {
      projects,
      tasks,
      agents,
      entities,
      transactions,
      decisions,
      signals,
      profile: state.profile
        ? { name: state.profile.name, role: state.profile.role }
        : undefined,
      activeEntityFilter: entityFilter !== "all" ? entityFilter : undefined,
    };
  }, [state, entityFilter, workspace, storedSignals]);

  // Entity options for filter
  const entityOptions = useMemo(() => {
    return state.entities.map((e) => ({ id: e.id, name: e.name }));
  }, [state.entities]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const trimmed = text.trim();
      const parsed = parseOctaneCommand({
        text: trimmed,
        source: "chat",
        projectConnections: state.projectConnections,
        projects: state.projects.map((p) => ({ id: p.id, name: p.name })),
      });
      if (parsed.actions.length > 0) {
        proposeOctaneActions(
          parsed.actions.map((p) => ({
            type: p.type,
            title: p.title,
            description: p.description,
            payload: p.payload,
            source: p.source,
            projectId: p.projectId,
          })),
        );
      }

      const replyPrefix =
        parsed.replies.length > 0
          ? `${parsed.replies.join("\n\n")}\n\n`
          : "";

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      const nextMessages: ChatMessage[] = [...messages, userMessage];
      setMessages(nextMessages);
      setInput("");
      setIsStreaming(true);

      // Placeholder for streaming
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: replyPrefix },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages, context }),
        });

        if (!res.ok) {
          const errData = (await res.json()) as { error?: string; setup?: boolean };
          if (errData.setup) setNeedsSetup(true);
          setMessages((prev) => [
            ...prev.slice(0, -1),
            {
              role: "assistant",
              content:
                replyPrefix +
                (errData.error ?? "Something went wrong."),
            },
          ]);
          setIsStreaming(false);
          return;
        }

        // Stream the response
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = replyPrefix;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;
            setMessages((prev) => [
              ...prev.slice(0, -1),
              { role: "assistant", content: fullText },
            ]);
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant",
            content:
              replyPrefix +
              `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, context, isStreaming, proposeOctaneActions, state.projectConnections, state.projects],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  function handleSuggestedPrompt(prompt: string) {
    void send(prompt);
  }

  function clearChat() {
    setMessages([]);
    setNeedsSetup(false);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800/80 px-6 py-4">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Octane AI"
            description="Your AI with full awareness of every entity, project, task, and decision."
          />
          <div className="flex items-center gap-3 shrink-0">
            {/* Entity filter */}
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="h-8 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300"
            >
              <option value="all">All entities</option>
              {entityOptions.map((e) => (
                <option key={e.id} value={e.name}>
                  {e.name}
                </option>
              ))}
            </select>
            {!isEmpty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="h-8 gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
              >
                <Trash2 className="size-3" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {pendingCount > 0 ? (
          <p className="mb-4 rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
            {pendingCount} proposed action{pendingCount === 1 ? "" : "s"} awaiting
            approval —{" "}
            <Link href="/actions" className="font-medium underline">
              review in Actions
            </Link>
          </p>
        ) : null}
        {needsSetup && <ApiSetupBanner />}

        {isEmpty && !needsSetup ? (
          <div className="flex h-full flex-col items-center justify-center gap-8">
            {/* Hero */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl border border-amber-800/40 bg-amber-950/30">
                <Sparkles className="size-8 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-100">
                Octane AI
              </h2>
              <p className="mt-2 max-w-sm text-sm text-zinc-400">
                Ask anything about your portfolio. Strategy, execution, finance,
                agents — with full context of all your data.
              </p>
            </div>

            {/* Suggested prompts */}
            <div className="w-full max-w-2xl">
              <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-600">
                Try asking
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSuggestedPrompt(prompt)}
                    disabled={isStreaming}
                    className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-3 text-left text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60 hover:text-zinc-100 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((msg, i) => (
              <ChatMessageBubble
                key={i}
                message={msg}
                isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800/80 px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3 rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-4 py-3 focus-within:border-zinc-600 focus-within:bg-zinc-900">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Octane AI anything about your portfolio…"
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-60"
              style={{ maxHeight: "160px" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${t.scrollHeight}px`;
              }}
            />
            <Button
              size="sm"
              onClick={() => void send(input)}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 h-8 w-8 rounded-lg bg-amber-600 p-0 hover:bg-amber-500 disabled:opacity-40"
            >
              {isStreaming ? (
                <Bot className="size-3.5 animate-pulse" />
              ) : (
                <Send className="size-3.5" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-zinc-600">
            Octane AI has access to your projects, tasks, agents, entities, finances, and decisions.
            {entityFilter !== "all" && (
              <span className="ml-1 text-amber-500/70">
                Focused on: {entityFilter}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
