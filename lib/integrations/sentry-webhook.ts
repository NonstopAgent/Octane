import { createHmac, timingSafeEqual } from "crypto";

import type { OctaneAction } from "@/lib/types/octane-action";
import type { Signal, SignalSeverity } from "@/lib/types/signal";

export type SentryWebhookExtract = {
  issueTitle: string;
  culpritFile: string;
  targetProjectSlug: string;
  stackTraceSnippet: string;
  issueId?: string;
  level?: string;
};

export type SentryIngestPayload = {
  signal: Signal;
  actionProposal: Omit<OctaneAction, "id" | "status" | "createdAt">;
  extracted: SentryWebhookExtract;
};

const PROJECT_SLUGS = ["octane-ajax", "octane-nexus", "octane-core"] as const;

function readHeader(
  headers: Headers,
  name: string,
): string | null {
  return headers.get(name) ?? headers.get(name.toLowerCase());
}

/** Validate Sentry hook signature against raw request body (HMAC SHA256 hex). */
export function verifySentryHookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.trim() || !secret.trim()) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.trim().toLowerCase();
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return expected === received;
  }
}

function inferProjectSlug(text: string): string {
  const hay = text.toLowerCase();
  for (const slug of PROJECT_SLUGS) {
    if (hay.includes(slug) || hay.includes(slug.replace("octane-", ""))) {
      return slug;
    }
  }
  if (/\bajax\b/.test(hay)) return "octane-ajax";
  if (/\bnexus\b/.test(hay)) return "octane-nexus";
  return "octane-core";
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function extractStackSnippet(payload: Record<string, unknown>): string {
  const event = (payload.event ?? payload.data) as Record<string, unknown> | undefined;
  const entries = (event?.entries ?? event?.exception) as unknown;
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const entryData = e.data as Record<string, unknown> | undefined;
      if (e.type === "exception" && Array.isArray(entryData?.values)) {
        const values = entryData.values as Array<Record<string, unknown>>;
        const frames = values[0]?.stacktrace as Record<string, unknown> | undefined;
        const frameList = frames?.frames as Array<Record<string, unknown>> | undefined;
        if (frameList?.length) {
          const top = frameList[frameList.length - 1];
          const fn = pickString(top?.function, top?.symbol);
          const file = pickString(top?.filename, top?.abs_path);
          return fn ? `${fn} @ ${file || "unknown"}` : file || "Exception stack available in Sentry.";
        }
      }
    }
  }
  const culprit = pickString(
    (payload.data as Record<string, unknown> | undefined)?.culprit,
    (payload.issue as Record<string, unknown> | undefined)?.culprit,
    event?.culprit,
  );
  return culprit || "See Sentry issue for full stack trace.";
}

/** Parse standard Sentry integration / issue alert webhook JSON. */
export function parseSentryWebhookPayload(
  payload: unknown,
): SentryWebhookExtract | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const issue = (data.issue ?? root.issue ?? data) as Record<string, unknown>;

  const issueTitle = pickString(
    issue.title,
    issue.metadata && (issue.metadata as Record<string, unknown>).title,
    data.title,
    root.message,
    "Production exception",
  );

  const culpritFile = pickString(
    issue.culprit,
    data.culprit,
    (issue.metadata as Record<string, unknown> | undefined)?.filename,
    "unknown source file",
  );

  const tags = [
    ...(Array.isArray(issue.tags) ? issue.tags : []),
    ...(Array.isArray(data.tags) ? data.tags : []),
  ] as Array<{ key?: string; value?: string } | [string, string]>;

  const tagText = tags
    .map((t) => {
      if (Array.isArray(t)) return `${t[0]}:${t[1]}`;
      return `${t.key ?? ""}:${t.value ?? ""}`;
    })
    .join(" ");

  const issueProject = issue.project as Record<string, unknown> | undefined;
  const dataProject = data.project as Record<string, unknown> | undefined;
  const projectSlug = pickString(
    data.project_slug,
    issueProject?.slug,
    dataProject?.slug,
  );

  const contextBlob = [
    issueTitle,
    culpritFile,
    tagText,
    projectSlug,
    JSON.stringify(data.project ?? issue.project ?? ""),
    JSON.stringify(root),
  ].join(" ");

  const targetProjectSlug = projectSlug
    ? inferProjectSlug(projectSlug)
    : inferProjectSlug(contextBlob);

  const stackTraceSnippet = extractStackSnippet(root);
  const issueId = pickString(issue.id, data.id);

  return {
    issueTitle,
    culpritFile,
    targetProjectSlug,
    stackTraceSnippet,
    issueId: issueId || undefined,
    level: pickString(issue.level, data.level) || undefined,
  };
}

function sentrySeverity(level?: string): SignalSeverity {
  const l = (level ?? "").toLowerCase();
  if (l === "fatal" || l === "error") return "critical";
  return "high";
}

function sigId(extracted: SentryWebhookExtract): string {
  const key = extracted.issueId ?? extracted.issueTitle.slice(0, 48);
  const slug = extracted.targetProjectSlug.replace(/[^a-z0-9-]/gi, "-");
  return `sig-sentry-${slug}-${key.replace(/[^a-z0-9-]/gi, "-")}`;
}

export function buildSentrySignal(extracted: SentryWebhookExtract): Signal {
  const now = new Date().toISOString();
  const severity = sentrySeverity(extracted.level);
  return {
    id: sigId(extracted),
    source: "system",
    type: "risk",
    title: `[Sentry Error] ${extracted.issueTitle}`,
    summary: `Exception triggered in ${extracted.culpritFile}. Trace context: ${extracted.stackTraceSnippet}`,
    severity,
    status: "new",
    recommendedAction:
      "Forward context to Octane Engineer for autonomous patch plan synthesis.",
    enrichedMetadata: {
      targetProjectSlug: extracted.targetProjectSlug,
      culpritFile: extracted.culpritFile,
      stackTraceSnippet: extracted.stackTraceSnippet,
      sentryIssueId: extracted.issueId ?? "",
    },
    relatedRecordType: "sentry_issue",
    relatedRecordId: extracted.issueId,
    isLive: true,
    isDerived: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildSentryHotfixActionProposal(
  extracted: SentryWebhookExtract,
  signal: Signal,
): Omit<OctaneAction, "id" | "status" | "createdAt"> {
  const slug = extracted.targetProjectSlug;
  const culprit = extracted.culpritFile;
  return {
    type: "create_coding_job",
    title: `Authorize Octane Engineer: Hotfix production exception in ${slug}`,
    description: `Programmatically initialize the Octane Engineer worker loop to checkout a hotfix branch on target repository, analyze throwing sequence in ${culprit}, test the layout type safety, and open a reviewable patch Pull Request on GitHub.`,
    payload: {
      signalId: signal.id,
      targetProjectSlug: slug,
      culpritFile: culprit,
      stackTraceSnippet: extracted.stackTraceSnippet,
      prompt: `Hotfix Sentry production exception: ${extracted.issueTitle}. Culprit: ${culprit}. Trace: ${extracted.stackTraceSnippet}`,
      title: `Hotfix: ${extracted.issueTitle}`,
    },
    source: "github",
    riskLevel: "critical",
    projectId: signal.projectId,
  };
}

export function buildSentryIngestPayload(
  payload: unknown,
): SentryIngestPayload | null {
  const extracted = parseSentryWebhookPayload(payload);
  if (!extracted) return null;
  const signal = buildSentrySignal(extracted);
  const actionProposal = buildSentryHotfixActionProposal(extracted, signal);
  return { signal, actionProposal, extracted };
}

export function validateSentryWebhookRequest(opts: {
  rawBody: string;
  headers: Headers;
  secret: string | undefined;
}): { ok: true; devBypass?: boolean } | { ok: false; reason: string } {
  const secret = opts.secret?.trim();
  if (!secret) {
    console.warn(
      "[sentry-webhook] SENTRY_WEBHOOK_SECRET not set — accepting payload in dev mapping mode (unsigned).",
    );
    return { ok: true, devBypass: true };
  }

  const signature =
    readHeader(opts.headers, "sentry-hook-signature") ??
    readHeader(opts.headers, "x-sentry-hook-signature");

  if (!signature) {
    return { ok: false, reason: "Missing Sentry hook signature header" };
  }

  if (!verifySentryHookSignature(opts.rawBody, signature, secret)) {
    return { ok: false, reason: "Invalid Sentry hook signature" };
  }

  return { ok: true };
}
