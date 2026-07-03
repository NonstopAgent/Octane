import { NextRequest, NextResponse } from "next/server";

import { enqueueSignalIngest } from "@/lib/integrations/ingest-queue";
import {
  buildVercelDeploySignal,
  parseVercelWebhookPayload,
  validateVercelWebhookRequest,
} from "@/lib/integrations/vercel-webhook";
import { dispatchCriticalAlert } from "@/lib/notifications/dispatcher";

export const runtime = "nodejs";

/**
 * Inbound Vercel deployment webhook → durable signal ingest queue.
 * Configure in Vercel: Team Settings → Webhooks → deployment.succeeded/error/canceled
 * pointing at <app-url>/api/integrations/vercel/webhook with VERCEL_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const auth = validateVercelWebhookRequest({
    rawBody,
    headers: request.headers,
    secret: process.env.VERCEL_WEBHOOK_SECRET,
  });

  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const extract = parseVercelWebhookPayload(payload);
  if (!extract) {
    // Unhandled event type — acknowledge so Vercel does not retry.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const signal = buildVercelDeploySignal(extract);
  const { channel, queueId } = await enqueueSignalIngest("vercel", { signal });

  // Server-side immediate alert for critical production failures — the client
  // drain also dispatches, but this path works even if nobody has the app open.
  if (signal.severity === "critical") {
    void dispatchCriticalAlert({
      dedupeKey: `alert:${signal.id}`,
      title: signal.title,
      severity: "critical",
      summary: signal.summary,
      source: "vercel",
      projectName: extract.projectName,
    });
  }

  return NextResponse.json({
    ok: true,
    queueId,
    channel,
    signalId: signal.id,
    event: extract.event,
    devBypass: "devBypass" in auth ? auth.devBypass : false,
    enqueuedAt: new Date().toISOString(),
  });
}
