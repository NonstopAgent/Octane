import { NextRequest, NextResponse } from "next/server";

import { enqueueSentryIngest } from "@/lib/integrations/sentry-ingest-queue";
import {
  buildSentryIngestPayload,
  validateSentryWebhookRequest,
} from "@/lib/integrations/sentry-webhook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const auth = validateSentryWebhookRequest({
    rawBody,
    headers: request.headers,
    secret: process.env.SENTRY_WEBHOOK_SECRET,
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

  const ingest = buildSentryIngestPayload(payload);
  if (!ingest) {
    return NextResponse.json(
      { error: "Unrecognized Sentry webhook payload" },
      { status: 422 },
    );
  }

  const { channel, queueId } = await enqueueSentryIngest(ingest);

  return NextResponse.json({
    ok: true,
    queueId,
    channel,
    signalId: ingest.signal.id,
    devBypass: "devBypass" in auth ? auth.devBypass : false,
    enqueuedAt: new Date().toISOString(),
  });
}
