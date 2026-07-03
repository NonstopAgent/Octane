import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { monitorServiceDb } from "@/lib/monitor/heartbeat";

export const runtime = "nodejs";

/**
 * Supabase health snapshot for the app's own database:
 * DB size, ingest queue depth, engineer queue state, heartbeat volume.
 * Uses the octane_db_health() security-definer function (service role only).
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const db = monitorServiceDb();
  if (!db) {
    return NextResponse.json({
      configured: false,
      message: "Set SUPABASE_SERVICE_ROLE_KEY to enable database health.",
    });
  }

  const { data, error } = await db.rpc("octane_db_health");
  if (error) {
    return NextResponse.json(
      { configured: true, connected: false, error: error.message },
      { status: 502 },
    );
  }

  const health = (data ?? {}) as Record<string, unknown>;
  const sizeBytes = Number(health.dbSizeBytes ?? 0);

  return NextResponse.json({
    configured: true,
    connected: true,
    dbSizeBytes: sizeBytes,
    dbSizeMb: Math.round((sizeBytes / (1024 * 1024)) * 10) / 10,
    signalQueuePending: Number(health.signalQueuePending ?? 0),
    signalQueueTotal: Number(health.signalQueueTotal ?? 0),
    engineerQueued: Number(health.engineerQueued ?? 0),
    engineerFailed: Number(health.engineerFailed ?? 0),
    heartbeatCount24h: Number(health.heartbeatCount24h ?? 0),
    checkedAt: new Date().toISOString(),
  });
}
