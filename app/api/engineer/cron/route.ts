import { NextRequest, NextResponse } from "next/server";

import {
  OCTANE_CRON_SECRET_HEADER,
  verifyOctaneCronSecret,
} from "@/lib/octane-engineer-cron-auth";
import { runInternalTypecheck } from "@/lib/octane-engineer-tasks";

export const runtime = "nodejs";

/**
 * POST /api/engineer/cron
 *
 * Secured with `OCTANE_SHARED_SECRET` via header `x-octane-cron-secret`.
 * Queues an internal typecheck without blocking the HTTP response.
 */
export async function POST(req: NextRequest) {
  if (!process.env.OCTANE_SHARED_SECRET?.trim()) {
    return NextResponse.json(
      { error: "OCTANE_SHARED_SECRET is not configured on the server." },
      { status: 503 },
    );
  }

  if (!verifyOctaneCronSecret(req)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        hint: `Send OCTANE_SHARED_SECRET in the ${OCTANE_CRON_SECRET_HEADER} header.`,
      },
      { status: 401 },
    );
  }

  void runInternalTypecheck().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/engineer/cron] Background typecheck failed:", message);
  });

  return NextResponse.json({
    ok: true,
    message: "Typecheck queued",
  });
}
