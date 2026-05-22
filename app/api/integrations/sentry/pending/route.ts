import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { drainSentryIngestQueue } from "@/lib/integrations/sentry-ingest-queue";

export const runtime = "nodejs";

/**
 * Authenticated drain of Sentry ingest queue for client Zustand merge.
 * In-memory fallback is process-local only (serverless cold starts may drop items).
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const items = await drainSentryIngestQueue();

  return NextResponse.json({
    items: items.map((item) => ({
      queueId: item.queueId,
      enqueuedAt: item.enqueuedAt,
      signal: item.signal,
      actionProposal: item.actionProposal,
      extracted: item.extracted,
    })),
    count: items.length,
    fetchedAt: new Date().toISOString(),
  });
}
