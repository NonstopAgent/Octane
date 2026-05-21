import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import {
  dispatchCriticalAlert,
  type CriticalAlertPayload,
} from "@/lib/notifications/dispatcher";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  let body: Partial<CriticalAlertPayload>;
  try {
    body = (await request.json()) as Partial<CriticalAlertPayload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dedupeKey = String(body.dedupeKey ?? "").trim();
  const title = String(body.title ?? "").trim();
  const summary = String(body.summary ?? "").trim();
  const severity = body.severity === "high" ? "high" : "critical";

  if (!dedupeKey || !title || !summary) {
    return NextResponse.json(
      { error: "dedupeKey, title, and summary are required" },
      { status: 400 },
    );
  }

  const result = await dispatchCriticalAlert({
    dedupeKey,
    title,
    summary,
    severity,
    source: body.source ? String(body.source) : undefined,
    projectName: body.projectName ? String(body.projectName) : undefined,
  });

  return NextResponse.json(result);
}
