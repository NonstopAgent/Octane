"use client";

import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  MessageCircleQuestion,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useShallow } from "zustand/react/shallow";

import { EmptyState } from "@/components/modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseOctaneCommand } from "@/lib/actions/parse-octane-command";
import { generateExecutiveAnswer } from "@/lib/executive";
import { ActionProposalCard } from "@/components/modules/actions/action-proposal-card";
import type { ExecutiveAnswer, ExecutiveConfidence } from "@/lib/executive";
import {
  selectOctanePersistedState,
  useOctaneStore,
  type OctanePersistedState,
} from "@/lib/store/octane-store";
import { cn } from "@/lib/utils";

export type ExecutiveNarrativeResult =
  | { summary: string }
  | { error: string; setup?: boolean };

/** POST /api/chat with mode executive_summary — read-only, no store mutations. */
export async function fetchExecutiveNarrativeSummary(
  executiveAnswer: ExecutiveAnswer,
): Promise<ExecutiveNarrativeResult> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "executive_summary", executiveAnswer }),
  });

  const data = (await res.json()) as {
    summary?: string;
    error?: string;
    setup?: boolean;
  };

  if (!res.ok) {
    return {
      error: data.error ?? "Failed to generate narrative summary.",
      setup: data.setup,
    };
  }

  if (!data.summary) {
    return { error: "No summary returned." };
  }

  return { summary: data.summary };
}

const SUGGESTED_QUESTIONS: { label: string; question: string }[] = [
  { label: "focus today", question: "What should I focus on today?" },
  { label: "building", question: "What are we building across active projects?" },
  { label: "own", question: "What is my ownership and holdings posture?" },
  { label: "blocked", question: "What is blocked right now?" },
  { label: "changed", question: "What changed recently?" },
  { label: "money", question: "How is money — revenue, burn, and runway?" },
  { label: "outlook", question: "What is the strategic outlook?" },
  { label: "improve", question: "What needs improvement?" },
  {
    label: "pause/double down",
    question: "Strategic plan — what should I pause or double down on?",
  },
  { label: "closest revenue", question: "Which projects are closest to revenue?" },
  { label: "risks", question: "What are the biggest risks?" },
  { label: "opportunities", question: "What are the top opportunities?" },
];

const CONFIDENCE_STYLES: Record<ExecutiveConfidence, string> = {
  high: "border-emerald-800/60 bg-emerald-950/30 text-emerald-300",
  medium: "border-amber-800/60 bg-amber-950/30 text-amber-300",
  low: "border-zinc-700/60 bg-zinc-900/50 text-zinc-400",
};

type RelatedGroup = {
  label: string;
  href: string;
  items: { id: string; name: string }[];
};

function buildRelatedGroups(
  answer: ExecutiveAnswer,
  state: OctanePersistedState,
): RelatedGroup[] {
  const groups: RelatedGroup[] = [];

  if (answer.relatedProjects.length > 0) {
    groups.push({
      label: "Projects",
      href: "/projects",
      items: answer.relatedProjects.map((id) => ({
        id,
        name: state.projects.find((p) => p.id === id)?.name ?? "Project",
      })),
    });
  }

  if (answer.relatedTasks.length > 0) {
    groups.push({
      label: "Tasks",
      href: "/tasks",
      items: answer.relatedTasks.map((id) => ({
        id,
        name: state.tasks.find((t) => t.id === id)?.title ?? "Task",
      })),
    });
  }

  if (answer.relatedDecisions.length > 0) {
    groups.push({
      label: "Decisions",
      href: "/decisions",
      items: answer.relatedDecisions.map((id) => ({
        id,
        name: state.decisions.find((d) => d.id === id)?.title ?? "Decision",
      })),
    });
  }

  if (answer.relatedDocuments.length > 0) {
    groups.push({
      label: "Documents",
      href: "/documents",
      items: answer.relatedDocuments.map((id) => ({
        id,
        name: state.documents.find((d) => d.id === id)?.name ?? "Document",
      })),
    });
  }

  if (answer.relatedHoldings.length > 0) {
    groups.push({
      label: "Holdings",
      href: "/holdings",
      items: answer.relatedHoldings.map((id) => ({
        id,
        name: state.entities.find((e) => e.id === id)?.name ?? "Entity",
      })),
    });
  }

  if (answer.relatedAgents.length > 0) {
    groups.push({
      label: "Agents",
      href: "/agents",
      items: answer.relatedAgents.map((id) => ({
        id,
        name: state.agents.find((a) => a.id === id)?.name ?? "Agent",
      })),
    });
  }

  return groups;
}

function AnswerBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        {title}
      </p>
      {children}
    </div>
  );
}

function RelatedRecords({ groups }: { groups: RelatedGroup[] }) {
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 text-[11px] font-medium text-zinc-500">{group.label}</p>
          <ul className="flex flex-wrap gap-1.5">
            {group.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={group.href}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-900/50 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:text-amber-300"
                >
                  {item.name}
                  <ArrowRight className="size-3 opacity-60" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ExecutiveAnswerCard({
  answer,
  state,
}: {
  answer: ExecutiveAnswer;
  state: OctanePersistedState;
}) {
  const relatedGroups = buildRelatedGroups(answer, state);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  useEffect(() => {
    setNarrative(null);
    setNarrativeError(null);
    setNarrativeLoading(false);
  }, [answer.answerTitle, answer.category, answer.directAnswer]);

  async function handleGenerateNarrative() {
    setNarrativeLoading(true);
    setNarrativeError(null);
    const result = await fetchExecutiveNarrativeSummary(answer);
    setNarrativeLoading(false);

    if ("summary" in result) {
      setNarrative(result.summary);
      return;
    }

    setNarrativeError(result.error);
    if (result.setup) setAiUnavailable(true);
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
      <AnswerHeader answer={answer} />

      <p className="text-sm leading-relaxed text-zinc-200">{answer.directAnswer}</p>

      {answer.sensitiveTopicWarning ? (
        <div className="flex gap-2 rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-200/90">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-400" aria-hidden />
          <p>{answer.sensitiveTopicWarning}</p>
        </div>
      ) : null}

      {answer.supportingSignals.length > 0 ? (
        <AnswerBlock title="Supporting signals">
          <ul className="space-y-2">
            {answer.supportingSignals.map((signal) => (
              <li
                key={`${signal.label}-${signal.detail}`}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs",
                  signal.severity === "critical"
                    ? "border-red-900/40 bg-red-950/20 text-zinc-300"
                    : signal.severity === "warning"
                      ? "border-amber-900/40 bg-amber-950/15 text-zinc-300"
                      : "border-zinc-800/90 bg-zinc-900/30 text-zinc-400",
                )}
              >
                <p className="font-medium text-zinc-200">{signal.label}</p>
                <p className="mt-0.5 text-zinc-500">{signal.detail}</p>
              </li>
            ))}
          </ul>
        </AnswerBlock>
      ) : null}

      {answer.recommendedActions.length > 0 ? (
        <AnswerBlock title="Recommended actions">
          <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-400">
            {answer.recommendedActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </AnswerBlock>
      ) : null}

      {relatedGroups.length > 0 ? (
        <AnswerBlock title="Related records">
          <RelatedRecords groups={relatedGroups} />
        </AnswerBlock>
      ) : null}

      <div className="border-t border-zinc-800/80 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            AI narrative (optional)
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            disabled={aiUnavailable || narrativeLoading}
            onClick={() => void handleGenerateNarrative()}
          >
            {narrativeLoading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {narrative ? "Regenerate narrative" : "Generate AI narrative"}
          </Button>
        </div>
        {narrativeError ? (
          <p className="mt-2 text-xs text-amber-300/90">{narrativeError}</p>
        ) : null}
        {narrative ? (
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">{narrative}</p>
        ) : (
          <p className="mt-2 text-xs text-zinc-600">
            Summarizes the structured answer above via{" "}
            <code className="text-zinc-500">executive_summary</code> mode — read-only,
            no portfolio mutations.
          </p>
        )}
      </div>

      <p className="text-[10px] leading-relaxed text-zinc-600">
        Rule-based answer from local portfolio data — not legal, tax, or investment
        advice.
      </p>
    </div>
  );
}

function AnswerHeader({ answer }: { answer: ExecutiveAnswer }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 className="text-sm font-semibold text-zinc-100">{answer.answerTitle}</h3>
      <Badge variant="outline" className={CONFIDENCE_STYLES[answer.confidence]}>
        {answer.confidence} confidence
      </Badge>
    </div>
  );
}

function scrollToAskOctane(inputRef: RefObject<HTMLInputElement | null>) {
  const el = document.getElementById("ask-octane");
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
  inputRef.current?.focus();
}

export function AskOctanePanel() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const state = useOctaneStore(useShallow(selectOctanePersistedState));
  const proposeOctaneActions = useOctaneStore((s) => s.proposeOctaneActions);
  const approveOctaneAction = useOctaneStore((s) => s.approveOctaneAction);
  const rejectOctaneAction = useOctaneStore((s) => s.rejectOctaneAction);
  const octaneActions = useOctaneStore((s) => s.octaneActions);
  const [questionInput, setQuestionInput] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [lastProposedIds, setLastProposedIds] = useState<string[]>([]);

  const answer = useMemo(() => {
    if (!submittedQuestion?.trim()) return null;
    return generateExecutiveAnswer(submittedQuestion, state);
  }, [submittedQuestion, state]);

  useEffect(() => {
    function onHashChange() {
      if (window.location.hash !== "#ask-octane") return;
      scrollToAskOctane(inputRef);
    }

    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const proposedFromChat = useMemo(
    () => octaneActions.filter((a) => lastProposedIds.includes(a.id)),
    [octaneActions, lastProposedIds],
  );

  function submitQuestion(question: string, chipLabel: string | null = null) {
    const trimmed = question.trim();
    if (!trimmed) return;
    setQuestionInput(trimmed);
    setSubmittedQuestion(trimmed);
    setActiveChip(chipLabel);

    const proposals = parseOctaneCommand({ text: trimmed, source: "chat" });
    if (proposals.length > 0) {
      const created = proposeOctaneActions(
        proposals.map((p) => ({
          type: p.type,
          title: p.title,
          description: p.description,
          payload: p.payload,
          source: p.source,
          projectId: p.projectId,
        })),
      );
      setLastProposedIds(created.map((a) => a.id));
    } else {
      setLastProposedIds([]);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submitQuestion(questionInput, null);
  }

  return (
    <section id="ask-octane" className="scroll-mt-6 space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor={inputId} className="sr-only">
          Ask Octane a question
        </label>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            id={inputId}
            value={questionInput}
            onChange={(event) => setQuestionInput(event.target.value)}
            placeholder="Ask about focus, money, risks, outlook…"
            className="border-zinc-700/80 bg-zinc-950/60 text-zinc-100 placeholder:text-zinc-600"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="sm"
            className="shrink-0 gap-1.5 bg-amber-600 text-zinc-950 hover:bg-amber-500"
            disabled={!questionInput.trim()}
          >
            <Send className="size-3.5" aria-hidden />
            Ask
          </Button>
        </div>
      </form>

      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Suggested questions
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => submitQuestion(chip.question, chip.label)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                activeChip === chip.label
                  ? "border-amber-600/60 bg-amber-950/30 text-amber-300"
                  : "border-zinc-700/60 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {proposedFromChat.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-amber-800/30 bg-amber-950/10 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-400/80">
            Proposed actions — approve to run
          </p>
          <div className="space-y-2">
            {proposedFromChat.map((action) => (
              <ActionProposalCard
                key={action.id}
                action={action}
                onApprove={approveOctaneAction}
                onReject={rejectOctaneAction}
              />
            ))}
          </div>
        </section>
      ) : null}

      {answer ? (
        <ExecutiveAnswerCard answer={answer} state={state} />
      ) : (
        <EmptyState
          icon={MessageCircleQuestion}
          title="Ask Octane anything about your company"
          description="Answers are generated from your local portfolio — projects, tasks, finance, agents, holdings, and activity. Pick a chip or type a question, then submit."
          className="py-10"
        />
      )}

      <ReadOnlyNote />
    </section>
  );
}

function ReadOnlyNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-3 py-2.5">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-zinc-500" aria-hidden />
      <p className="text-[11px] leading-relaxed text-zinc-500">
        Read-only intelligence — Ask Octane does not change projects, tasks, or
        finances. Optional AI narrative uses executive_summary mode when configured.
      </p>
    </div>
  );
}
