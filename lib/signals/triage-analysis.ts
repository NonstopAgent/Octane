import Anthropic from "@anthropic-ai/sdk";

import type {
  SignalSeverity,
  SignalSource,
  SignalTriageAnalysis,
} from "@/lib/types/signal";

export type TriageClusterSignalInput = {
  id: string;
  title: string;
  source: SignalSource;
  summary: string;
  description?: string;
  projectId?: string;
  severity?: SignalSeverity;
};

export type TriageClusterRequest = {
  signals: TriageClusterSignalInput[];
};

const TRIAGE_TIMEOUT_MS = 25_000;

function parseTriageJson(text: string): Omit<
  SignalTriageAnalysis,
  "analyzedAt" | "source" | "signalIds"
> | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const rootCauseEstimate =
      typeof raw.rootCauseEstimate === "string"
        ? raw.rootCauseEstimate.trim()
        : "";
    const operationalImpact =
      typeof raw.operationalImpact === "string"
        ? raw.operationalImpact.trim()
        : "";
    const structuredMitigationStep =
      typeof raw.structuredMitigationStep === "string"
        ? raw.structuredMitigationStep.trim()
        : "";
    if (!rootCauseEstimate || !operationalImpact || !structuredMitigationStep) {
      return null;
    }
    return { rootCauseEstimate, operationalImpact, structuredMitigationStep };
  } catch {
    return null;
  }
}

function ajaxNexusContext(sources: Set<SignalSource>): string {
  const touchesAjax = sources.has("vercel") || sources.has("github");
  const touchesNexus = sources.has("agent") || sources.has("project");
  if (touchesAjax && touchesNexus) {
    return "Spans Octane Ajax (customer-facing app) and Nexus (agent/orchestration layer); coordinate fixes across both surfaces.";
  }
  if (touchesAjax) {
    return "Primarily affects Octane Ajax — customer deployments, product UX, and revenue-facing uptime.";
  }
  if (touchesNexus) {
    return "Primarily affects Octane Nexus — agent workflows, orchestration, and internal automation.";
  }
  return "Affects Octane Core portfolio operations — triage via /signals and linked projects.";
}

export function buildRuleBasedTriageAnalysis(
  cluster: TriageClusterRequest,
): SignalTriageAnalysis {
  const ids = cluster.signals.map((s) => s.id);
  const titles = cluster.signals.map((s) => s.title);
  const sources = new Set(cluster.signals.map((s) => s.source));
  const projectIds = [
    ...new Set(
      cluster.signals.map((s) => s.projectId).filter((id): id is string => Boolean(id)),
    ),
  ];

  const rootCauseEstimate =
    cluster.signals.length === 1
      ? `Likely driven by: ${cluster.signals[0].summary}`
      : `Cluster of ${cluster.signals.length} related signals — shared theme across ${[...sources].join(", ")} sources. Review: ${titles.slice(0, 3).join("; ")}${titles.length > 3 ? "…" : ""}.`;

  const operationalImpact = ajaxNexusContext(sources);

  const structuredMitigationStep =
    projectIds.length > 0
      ? `1) Acknowledge signals on /signals. 2) Assign owners on projects ${projectIds.join(", ")}. 3) Resolve highest-severity item first; re-run cluster analysis after deploy.`
      : "1) Acknowledge all cluster signals. 2) Link each signal to a project or task. 3) Resolve root blocker, then dismiss resolved duplicates.";

  return {
    rootCauseEstimate,
    operationalImpact,
    structuredMitigationStep,
    analyzedAt: new Date().toISOString(),
    source: "rule-based",
    signalIds: ids,
  };
}

async function generateAnthropicTriage(
  cluster: TriageClusterRequest,
): Promise<SignalTriageAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const signalLines = cluster.signals
    .map(
      (s) =>
        `- [${s.id}] ${s.title} (${s.source})${s.projectId ? ` project=${s.projectId}` : ""}\n  ${s.description ?? s.summary}`,
    )
    .join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRIAGE_TIMEOUT_MS);

  try {
    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 900,
        system: `You are Octane's deep-triage engine for Logan's portfolio (Ajax app, Nexus agents, Core OS).
Output ONLY valid JSON with keys: rootCauseEstimate, operationalImpact, structuredMitigationStep.
operationalImpact must explain Ajax vs Nexus vs Core context in 1-2 sentences.
structuredMitigationStep must be numbered, actionable steps (max 5).`,
        messages: [
          {
            role: "user",
            content: `Analyze this cluster of critical/high signals:\n\n${signalLines}`,
          },
        ],
      },
      { signal: controller.signal },
    );

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");

    const parsed = parseTriageJson(text);
    if (!parsed) return null;

    return {
      ...parsed,
      analyzedAt: new Date().toISOString(),
      source: "anthropic",
      signalIds: cluster.signals.map((s) => s.id),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeSignalCluster(
  cluster: TriageClusterRequest,
): Promise<{ analysis: SignalTriageAnalysis; source: "anthropic" | "rule-based" }> {
  if (cluster.signals.length === 0) {
    const empty = buildRuleBasedTriageAnalysis({ signals: [] });
    return { analysis: empty, source: "rule-based" };
  }

  const ai = await generateAnthropicTriage(cluster);
  if (ai) {
    return { analysis: ai, source: "anthropic" };
  }

  return {
    analysis: buildRuleBasedTriageAnalysis(cluster),
    source: "rule-based",
  };
}
