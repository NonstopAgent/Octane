import { NextRequest, NextResponse } from "next/server";

import { enqueueSignalIngest } from "@/lib/integrations/ingest-queue";
import { dispatchCriticalAlert } from "@/lib/notifications/dispatcher";
import type { Signal, SignalSeverity } from "@/lib/types/signal";

export const runtime = "nodejs";

/**
 * PostHog error-tracking webhook → Octane signal.
 * Configure a PostHog HTTP destination (or error-tracking issue webhook)
 * pointed here with header `x-octane-webhook-secret: POSTHOG_WEBHOOK_SECRET`.
 * Dev mode (secret unset) accepts unsigned payloads like the other webhooks.
 */

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function hostToProjectSlug(url: string): string {
  const host = url.toLowerCase();
  if (host.includes("octane-nexus")) return "octane-nexus";
  if (host.includes("octane-ajax")) return "octane-ajax";
  if (host.includes("octane-lake") || host.includes("octane-nonstopagents")) {
    return "octane-core";
  }
  return "octane-core";
}

function severityFor(level: string, event: string): SignalSeverity {
  if (event === "$error_tracking_issue_spiking") return "critical";
  const l = level.toLowerCase();
  if (l === "fatal") return "critical";
  return "high";
}

export async function POST(request: NextRequest) {
  const secret = process.env.POSTHOG_WEBHOOK_SECRET?.trim();
  if (secret) {
    const provided =
      request.headers.get("x-octane-webhook-secret") ??
      request.nextUrl.searchParams.get("secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }
  } else {
    console.warn(
      "[posthog-webhook] POSTHOG_WEBHOOK_SECRET not set — accepting payload in dev mapping mode.",
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // PostHog webhook alerts POST { event: {...}, person: {...} }; raw HTTP
  // destinations may send the event flat. Handle both.
  const eventObj =
    payload.event && typeof payload.event === "object"
      ? (payload.event as Record<string, unknown>)
      : payload;
  const properties = (eventObj.properties ?? payload.properties ?? payload) as Record<
    string,
    unknown
  >;
  const event = str(eventObj.event) || str(payload.event) || "$exception";
  const message =
    str(properties.name) ||
    str(properties.$exception_message) ||
    str(properties.description) ||
    str((payload as Record<string, unknown>).message) ||
    str(payload.issue_title) ||
    "Unhandled exception";
  const exceptionType = str(properties.$exception_type);
  const url = str(properties.$current_url) || str(properties.url);
  const level = str(properties.$level) || str(payload.severity);
  const issueId = str(payload.issue_id) || str(properties.$exception_issue_id);

  const slug = hostToProjectSlug(url);
  const severity = severityFor(level, event);
  const dedupe =
    issueId ||
    `${slug}-${message.slice(0, 40).replace(/[^a-zA-Z0-9]/g, "-")}`;

  const now = new Date().toISOString();
  const signal: Signal = {
    id: `sig-posthog-error-${dedupe.replace(/[^a-zA-Z0-9-]/g, "-")}`,
    source: "system",
    type: "risk",
    title: `[Error] ${exceptionType ? `${exceptionType}: ` : ""}${message.slice(0, 120)}`,
    summary: `PostHog captured ${event === "$error_tracking_issue_spiking" ? "a SPIKING error issue" : "an exception"} on ${slug}${url ? ` (${url})` : ""}: ${message.slice(0, 300)}`,
    severity,
    status: "new",
    recommendedAction:
      "Open PostHog error tracking for the stack trace; Octane Engineer can draft a hotfix PR.",
    enrichedMetadata: {
      targetProjectSlug: slug,
      provider: "posthog",
      event,
      url,
      posthogIssueId: issueId,
      alertEligible: severity === "critical",
    },
    relatedRecordType: "posthog_error",
    relatedRecordId: dedupe,
    isLive: true,
    isDerived: false,
    createdAt: now,
    updatedAt: now,
  };

  const { channel, queueId } = await enqueueSignalIngest("posthog", { signal });

  if (severity === "critical") {
    void dispatchCriticalAlert({
      dedupeKey: `alert:${signal.id}`,
      title: signal.title,
      severity: "critical",
      summary: signal.summary,
      source: "posthog",
      projectName: slug,
    });
  }

  return NextResponse.json({
    ok: true,
    queueId,
    channel,
    signalId: signal.id,
    enqueuedAt: now,
  });
}
