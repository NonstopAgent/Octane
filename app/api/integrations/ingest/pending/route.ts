import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { drainSignalIngestQueue } from "@/lib/integrations/ingest-queue";

export const runtime = "nodejs";

/**
 * Authenticated drain of the generic signal ingest queue (all sources:
 * sentry, vercel, github, monitor, …) for client Zustand merge.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const items = await drainSignalIngestQueue();

  return NextResponse.json({
    items: items.map((item) => ({
      queueId: item.queueId,
      source: item.source,
      enqueuedAt: item.enqueuedAt,
      signal: item.signal,
      actionProposal: item.actionProposal ?? null,
      extracted: item.extracted ?? null,
    })),
    count: items.length,
    fetchedAt: new Date().toISOString(),
  });
}
