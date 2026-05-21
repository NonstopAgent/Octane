import type { OctaneOutlookInput } from "@/lib/outlook/generate-octane-outlook";
import type { Project } from "@/lib/types";
import type { Signal } from "@/lib/types/signal";

export type SignalOutlookAdjustment = {
  penalty: number;
  highlights: string[];
  executionPenalty: number;
  revenuePenalty: number;
  agentPenalty: number;
};

const PORTFOLIO_MATCHERS: { label: string; patterns: string[] }[] = [
  { label: "Ajax", patterns: ["octane-ajax", "ajax"] },
  { label: "Nexus", patterns: ["octane-nexus", "nexus"] },
  { label: "Core", patterns: ["octane-core", "octane"] },
];

function isUnresolved(signal: Signal): boolean {
  return signal.status !== "resolved" && signal.status !== "dismissed";
}

function isSevereUnresolved(signal: Signal): boolean {
  return (
    isUnresolved(signal) &&
    (signal.severity === "critical" || signal.severity === "high")
  );
}

function projectPortfolioLabel(
  project: Project | undefined,
  signal: Signal,
): string | null {
  const haystack = [
    project?.name ?? "",
    signal.title,
    signal.summary,
  ]
    .join(" ")
    .toLowerCase();

  for (const { label, patterns } of PORTFOLIO_MATCHERS) {
    if (patterns.some((p) => haystack.includes(p))) return label;
  }
  return null;
}

function countSevereByPortfolio(
  signals: Signal[],
  projects: Project[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const signal of signals.filter(isSevereUnresolved)) {
    const project = signal.projectId
      ? projects.find((p) => p.id === signal.projectId)
      : undefined;
    const label = projectPortfolioLabel(project, signal) ?? "Portfolio";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

export function computeSignalOutlookAdjustment(
  state: OctaneOutlookInput,
): SignalOutlookAdjustment {
  const signals = state.signals ?? [];
  const severe = signals.filter(isSevereUnresolved);
  const critical = severe.filter((s) => s.severity === "critical");
  const high = severe.filter((s) => s.severity === "high");

  const byPortfolio = countSevereByPortfolio(signals, state.projects);
  const highlights: string[] = [];

  let penalty = 0;
  penalty += Math.min(18, critical.length * 6 + high.length * 3);

  for (const [label, count] of byPortfolio) {
    if (count >= 2 && ["Ajax", "Nexus", "Core"].includes(label)) {
      penalty += 4;
      highlights.push(
        `${label}: ${count} unresolved critical/high signals — operational outlook reduced.`,
      );
    }
  }

  if (critical.length > 0 && highlights.length === 0) {
    highlights.push(
      `${critical.length} unresolved critical signal${critical.length === 1 ? "" : "s"} affecting outlook.`,
    );
  }
  if (high.length > 0 && highlights.length < 2) {
    highlights.push(
      `${high.length} unresolved high-severity signal${high.length === 1 ? "" : "s"} on the watchlist.`,
    );
  }

  penalty = Math.min(28, penalty);

  const executionPenalty = Math.min(12, critical.length * 4 + high.length * 2);
  const revenuePenalty = severe.some(
    (s) => s.source === "finance" || s.type === "cost" || s.type === "revenue",
  )
    ? Math.min(10, 6 + critical.filter((s) => s.source === "finance").length * 2)
    : 0;
  const agentPenalty = severe.some((s) => s.source === "agent" || s.source === "vercel")
    ? Math.min(8, critical.length * 2)
    : 0;

  return {
    penalty,
    highlights: highlights.slice(0, 4),
    executionPenalty,
    revenuePenalty,
    agentPenalty,
  };
}

export function buildSignalOutlookPlanNotes(
  adjustment: SignalOutlookAdjustment,
): string[] {
  if (adjustment.penalty === 0) return [];
  return [
    "Clear unresolved critical/high signals on /signals before expanding scope.",
    ...adjustment.highlights.slice(0, 2),
  ];
}
