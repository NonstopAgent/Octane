import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE } from "@/lib/auth/constants";
import { enqueueSignalIngest } from "@/lib/integrations/ingest-queue";
import {
  buildDownSignal,
  monitorServiceDb,
  runHeartbeats,
  wasDownBefore,
} from "@/lib/monitor/heartbeat";
import { dispatchCriticalAlert } from "@/lib/notifications/dispatcher";

export const runtime = "nodejs";

/**
 * Uptime heartbeat runner.
 * Auth: Vercel cron (Authorization: Bearer CRON_SECRET) or an authenticated
 * app session (cookie) — the client triggers this every 5 minutes while open.
 */
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return req.cookies.get(AUTH_COOKIE_NAME)?.value === AUTH_COOKIE_VALUE;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = monitorServiceDb();
  if (!db) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not set — heartbeats need the durable store" },
      { status: 503 },
    );
  }

  const results = await runHeartbeats(db);

  // Emit a critical signal + immediate alert on fresh downs (up → down edge).
  const downs = results.filter((r) => !r.ok);
  let signaled = 0;
  for (const down of downs) {
    const alreadyDown = await wasDownBefore(db, down.targetId);
    if (alreadyDown) continue;
    const signal = buildDownSignal(down);
    await enqueueSignalIngest("monitor", { signal });
    void dispatchCriticalAlert({
      dedupeKey: `alert:${signal.id}:${new Date().toISOString().slice(0, 13)}`,
      title: signal.title,
      severity: "critical",
      summary: signal.summary,
      source: "monitor",
      projectName: down.projectName,
    });
    signaled += 1;
  }

  return NextResponse.json({
    ok: true,
    checked: results.length,
    up: results.filter((r) => r.ok).length,
    down: downs.length,
    newDownSignals: signaled,
    results: results.map((r) => ({
      projectName: r.projectName,
      ok: r.ok,
      statusCode: r.statusCode,
      latencyMs: r.latencyMs,
      error: r.error,
    })),
    checkedAt: new Date().toISOString(),
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
