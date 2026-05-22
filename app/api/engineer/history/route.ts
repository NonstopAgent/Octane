import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { fetchEngineerExecutionHistory } from "@/lib/octane-engineer-history";

export const runtime = "nodejs";

/**
 * GET /api/engineer/history
 *
 * Read-only audit trail. Query params: `status`, `command_type`, `project`.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = request.nextUrl;

  try {
    const executions = await fetchEngineerExecutionHistory({
      status: searchParams.get("status") ?? undefined,
      command_type: searchParams.get("command_type") ?? undefined,
      project: searchParams.get("project") ?? undefined,
    });

    return NextResponse.json(executions);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load history";
    const isConfig = message.includes("service role not configured");
    console.error("[api/engineer/history]", message);
    return NextResponse.json(
      { error: message },
      { status: isConfig ? 503 : 500 },
    );
  }
}
