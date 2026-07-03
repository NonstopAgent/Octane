import { NextRequest, NextResponse } from "next/server";

import {
  buildGithubSignal,
  parseGithubWebhookPayload,
  validateGithubWebhookRequest,
} from "@/lib/integrations/github-webhook";
import { enqueueSignalIngest } from "@/lib/integrations/ingest-queue";
import { dispatchCriticalAlert } from "@/lib/notifications/dispatcher";

export const runtime = "nodejs";

/**
 * Inbound GitHub webhook → durable signal ingest queue.
 * Configure per repo: Settings → Webhooks → <app-url>/api/integrations/github/webhook,
 * content type application/json, secret = GITHUB_WEBHOOK_SECRET,
 * events: push, pull requests, workflow runs, Dependabot alerts.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const event =
    request.headers.get("x-github-event") ?? request.headers.get("X-GitHub-Event") ?? "";

  const auth = validateGithubWebhookRequest({
    rawBody,
    headers: request.headers,
    secret: process.env.GITHUB_WEBHOOK_SECRET,
  });

  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  if (event === "ping") {
    return NextResponse.json({ ok: true, pong: true });
  }

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const extract = parseGithubWebhookPayload(event, payload);
  if (!extract) {
    // Unhandled event/action — acknowledge so GitHub does not flag delivery failures.
    return NextResponse.json({ ok: true, ignored: true, event });
  }

  const signal = buildGithubSignal(extract);
  const { channel, queueId } = await enqueueSignalIngest("github", { signal });

  if (extract.alertEligible && (signal.severity === "critical" || signal.severity === "high")) {
    void dispatchCriticalAlert({
      dedupeKey: `alert:${signal.id}`,
      title: signal.title,
      severity: signal.severity === "high" ? "high" : "critical",
      summary: signal.summary,
      source: "github",
      projectName: extract.repo,
    });
  }

  return NextResponse.json({
    ok: true,
    queueId,
    channel,
    signalId: signal.id,
    event,
    devBypass: "devBypass" in auth ? auth.devBypass : false,
    enqueuedAt: new Date().toISOString(),
  });
}
