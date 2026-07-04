import { buildSentryHotfixActionProposal } from "@/lib/integrations/sentry-webhook";
import type { SentryWebhookExtract } from "@/lib/integrations/sentry-webhook";
import { actionDedupeKey } from "@/lib/types/octane-action";
import type {
  OctaneActionRiskLevel,
  OctaneActionSource,
} from "@/lib/types/octane-action";
import type { OctaneStore } from "@/lib/store/octane-store";
import type { Signal } from "@/lib/types/signal";

function riskFromSeverity(severity: Signal["severity"]): OctaneActionRiskLevel {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  return "medium";
}

/** Map a signal source onto the constrained action-source enum. */
function actionSourceFromSignal(source: Signal["source"]): OctaneActionSource {
  if (source === "github" || source === "gmail" || source === "vercel") {
    return source;
  }
  return "system";
}

/**
 * Signal sources we never auto-propose from:
 * - "action": the "N actions awaiting approval" signal would recurse.
 * - "system"/"manual": housekeeping, not real work.
 */
const SKIP_SOURCES = new Set<Signal["source"]>(["action", "system", "manual"]);

/** Informational signal types that don't warrant a task. */
const SKIP_TYPES = new Set<Signal["type"]>(["progress", "note", "system"]);

/** External live sources whose urgency should flow through to action risk. */
const EXTERNAL_URGENT = new Set<Signal["source"]>(["gmail", "vercel"]);

const SEVERITY_RANK: Record<Signal["severity"], number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/** Keep the queue focused — hard caps so proposals never flood Actions. */
const MAX_PENDING_SIGNAL_ACTIONS = 12;
const MAX_NEW_PER_PASS = 6;

function isSentryErrorSignal(signal: Signal): boolean {
  return signal.title.startsWith("[Sentry Error]");
}

function sentryExtractFromSignal(signal: Signal): SentryWebhookExtract {
  const meta = signal.enrichedMetadata ?? {};
  const issueTitle =
    signal.title.replace(/^\[Sentry Error\]\s*/i, "") || "Production exception";
  return {
    issueTitle,
    culpritFile: String(meta.culpritFile ?? "unknown source file"),
    targetProjectSlug: String(meta.targetProjectSlug ?? "octane-core"),
    stackTraceSnippet: String(meta.stackTraceSnippet ?? signal.summary),
    issueId: signal.relatedRecordId,
  };
}

/**
 * Auto-propose approvable actions from live + derived signals so the Actions
 * queue (and, on approval, Tasks) populate themselves.
 *
 * Curation rules keep this useful, not noisy:
 * - Only untriaged (status "new"), medium/high/critical, actionable signals.
 * - Sentry keeps its dedicated hotfix-coding-job path.
 * - Dedupe by signalId across every non-rejected action — a signal is proposed
 *   exactly once, and never re-proposed after approve/execute (loop-proof).
 * - Routine internal work is proposed at "medium" risk so it never dents the
 *   operational score; only external urgent (gmail/vercel) signals carry their
 *   real high/critical risk.
 * - Hard caps bound how many land per pass and in total.
 */
export function syncSignalActionProposals(
  get: () => OctaneStore,
  signals: Signal[],
): void {
  const store = get();
  const actions = store.octaneActions;

  const pendingKeys = new Set(
    actions
      .filter((a) => a.status === "pending")
      .map((a) => actionDedupeKey(a)),
  );

  // Signal ids already covered by a non-rejected action (pending/approved/executed).
  const coveredSignalIds = new Set<string>();
  let pendingSignalActionCount = 0;
  for (const a of actions) {
    const sid =
      typeof a.payload?.signalId === "string"
        ? (a.payload.signalId as string)
        : undefined;
    if (!sid) continue;
    if (a.status !== "rejected") coveredSignalIds.add(sid);
    if (a.status === "pending") pendingSignalActionCount += 1;
  }

  // Most urgent first so caps favor what matters.
  const ordered = [...signals].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );

  let created = 0;
  for (const signal of ordered) {
    if (created >= MAX_NEW_PER_PASS) break;
    if (pendingSignalActionCount + created >= MAX_PENDING_SIGNAL_ACTIONS) break;

    // Sentry production errors → dedicated hotfix coding-job proposal.
    if (isSentryErrorSignal(signal)) {
      const proposal = buildSentryHotfixActionProposal(
        sentryExtractFromSignal(signal),
        signal,
      );
      const key = actionDedupeKey(proposal);
      if (pendingKeys.has(key)) continue;
      store.proposeAction(proposal);
      pendingKeys.add(key);
      created += 1;
      continue;
    }

    // Curation gate.
    if (signal.status !== "new") continue;
    if (SKIP_SOURCES.has(signal.source)) continue;
    if (SKIP_TYPES.has(signal.type)) continue;
    if (signal.severity === "low") continue;
    if (coveredSignalIds.has(signal.id)) continue;

    const source = actionSourceFromSignal(signal.source);
    const title = signal.title;
    const dupKey = `${source}:${title}`;
    if (pendingKeys.has(dupKey)) continue;

    const nextStep =
      signal.recommendedAction?.trim() ||
      "Review this in Signals, triage it, and take the next step.";

    const riskLevel: OctaneActionRiskLevel = EXTERNAL_URGENT.has(signal.source)
      ? riskFromSeverity(signal.severity)
      : "medium";

    store.proposeAction({
      type: "create_task",
      title,
      description: `${signal.summary}\n\nNext step: ${nextStep}`,
      payload: {
        signalId: signal.id,
        mitigation: nextStep,
        title,
        severity: signal.severity,
      },
      source,
      riskLevel,
      projectId: signal.projectId,
    });

    pendingKeys.add(dupKey);
    coveredSignalIds.add(signal.id);
    created += 1;
  }
}
