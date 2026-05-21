import type { Signal } from "@/lib/types/signal";

export type CriticalAlertPayload = {
  dedupeKey: string;
  title: string;
  severity: "critical" | "high";
  summary: string;
  source?: string;
  projectName?: string;
};

export type DispatchResult = {
  sent: boolean;
  channel: "webhook" | "placeholder";
  dedupeKey: string;
  skipped?: boolean;
};

const DISPATCH_DEDUPE_MS = 30 * 60 * 1000;
const WEBHOOK_TIMEOUT_MS = 8_000;

const recentDispatches = new Map<string, number>();

function pruneDedupeCache(now: number): void {
  for (const [key, at] of recentDispatches) {
    if (now - at > DISPATCH_DEDUPE_MS) recentDispatches.delete(key);
  }
}

function wasRecentlyDispatched(dedupeKey: string, now: number): boolean {
  const at = recentDispatches.get(dedupeKey);
  return at !== undefined && now - at < DISPATCH_DEDUPE_MS;
}

function markDispatched(dedupeKey: string, now: number): void {
  recentDispatches.set(dedupeKey, now);
}

function formatMarkdown(payload: CriticalAlertPayload): string {
  const lines = [
    `**[Octane] ${payload.severity.toUpperCase()} alert**`,
    `**${payload.title}**`,
    payload.summary,
  ];
  if (payload.source) lines.push(`Source: \`${payload.source}\``);
  if (payload.projectName) lines.push(`Project: ${payload.projectName}`);
  return lines.join("\n");
}

function isFinanceRunwaySignal(signal: Signal): boolean {
  if (signal.source !== "finance" && signal.source !== "gmail") return false;
  const haystack = `${signal.title} ${signal.summary}`.toLowerCase();
  return (
    signal.type === "cost" ||
    signal.type === "revenue" ||
    haystack.includes("runway") ||
    haystack.includes("cashflow") ||
    haystack.includes("burn")
  );
}

function isAlertEligibleSignal(signal: Signal): boolean {
  if (signal.status === "resolved" || signal.status === "dismissed") return false;

  if (
    signal.source === "vercel" &&
    signal.type === "deployment" &&
    signal.severity === "critical"
  ) {
    return true;
  }

  if (
    isFinanceRunwaySignal(signal) &&
    (signal.severity === "critical" || signal.severity === "high")
  ) {
    return true;
  }

  if (signal.source === "gmail" && signal.severity === "critical") {
    return true;
  }

  return false;
}

export function signalToCriticalAlert(signal: Signal): CriticalAlertPayload | null {
  if (!isAlertEligibleSignal(signal)) return null;

  return {
    dedupeKey: `alert:${signal.id}`,
    title: signal.title,
    severity: signal.severity === "high" ? "high" : "critical",
    summary: signal.summary,
    source: signal.source,
  };
}

export function criticalAlertsFromSignals(signals: Signal[]): CriticalAlertPayload[] {
  const out: CriticalAlertPayload[] = [];
  const seen = new Set<string>();
  for (const signal of signals) {
    const alert = signalToCriticalAlert(signal);
    if (!alert || seen.has(alert.dedupeKey)) continue;
    seen.add(alert.dedupeKey);
    out.push(alert);
  }
  return out;
}

/**
 * Read-only outbound notification — POST markdown to WEBHOOK_ALERT_URL or log placeholder.
 * Server-only; never expose the webhook URL to the client.
 */
export async function dispatchCriticalAlert(
  payload: CriticalAlertPayload,
): Promise<DispatchResult> {
  const now = Date.now();
  pruneDedupeCache(now);

  if (wasRecentlyDispatched(payload.dedupeKey, now)) {
    return {
      sent: false,
      channel: "placeholder",
      dedupeKey: payload.dedupeKey,
      skipped: true,
    };
  }

  const webhookUrl = process.env.WEBHOOK_ALERT_URL?.trim();
  const markdown = formatMarkdown(payload);

  if (webhookUrl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: markdown }),
        signal: controller.signal,
      });
      markDispatched(payload.dedupeKey, now);
      return {
        sent: res.ok,
        channel: "webhook",
        dedupeKey: payload.dedupeKey,
      };
    } catch {
      return {
        sent: false,
        channel: "webhook",
        dedupeKey: payload.dedupeKey,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  console.info(
    "[Octane alert placeholder]",
    payload.dedupeKey,
    payload.title,
    payload.summary.slice(0, 200),
  );
  markDispatched(payload.dedupeKey, now);
  return {
    sent: false,
    channel: "placeholder",
    dedupeKey: payload.dedupeKey,
  };
}

export async function dispatchCriticalAlertsForSignals(
  signals: Signal[],
): Promise<DispatchResult[]> {
  const alerts = criticalAlertsFromSignals(signals);
  const results: DispatchResult[] = [];
  for (const alert of alerts) {
    results.push(await dispatchCriticalAlert(alert));
  }
  return results;
}
