import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { monitorServiceDb } from "@/lib/monitor/heartbeat";

export const runtime = "nodejs";

/**
 * Durable signal history — reads the full ingest queue (consumed rows are
 * retained), so webhook signals survive browser resets and are queryable
 * from any device. Filters: ?source=vercel&limit=50
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const db = monitorServiceDb();
  if (!db) {
    return NextResponse.json({ configured: false, items: [] });
  }

  const source = request.nextUrl.searchParams.get("source");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 100), 500);

  let query = db
    .from("signal_ingest_queue")
    .select("id, source, payload, created_at, consumed_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (source) query = query.eq("source", source);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { configured: true, items: [], error: error.message },
      { status: 500 },
    );
  }

  type Row = {
    id: string;
    source: string;
    payload: { signal?: unknown } | null;
    created_at: string;
    consumed_at: string | null;
  };

  return NextResponse.json({
    configured: true,
    items: ((data ?? []) as Row[]).map((row) => ({
      queueId: row.id,
      source: row.source,
      signal: row.payload?.signal ?? null,
      receivedAt: row.created_at,
      deliveredToClient: row.consumed_at !== null,
    })),
    count: data?.length ?? 0,
    fetchedAt: new Date().toISOString(),
  });
}
