import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import {
  listMonitorTargets,
  monitorServiceDb,
  summarizeUptime,
} from "@/lib/monitor/heartbeat";

export const runtime = "nodejs";

/** GET: 24h uptime summary per monitored target. */
export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const db = monitorServiceDb();
  if (!db) {
    return NextResponse.json({ configured: false, targets: [] });
  }

  try {
    const targets = await summarizeUptime(db);
    return NextResponse.json({
      configured: true,
      targets,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { configured: true, targets: [], error: err instanceof Error ? err.message : "read failed" },
      { status: 500 },
    );
  }
}

/** POST: add or update a monitor target { projectName, url, enabled? }. */
export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const db = monitorServiceDb();
  if (!db) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 503 },
    );
  }

  let body: { projectName?: string; url?: string; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectName = body.projectName?.trim();
  const url = body.url?.trim();
  if (!projectName || !url || !/^https?:\/\//.test(url)) {
    return NextResponse.json(
      { error: "projectName and a valid http(s) url are required" },
      { status: 400 },
    );
  }

  const { data, error } = await db
    .from("monitor_targets")
    .upsert(
      { project_name: projectName, url, enabled: body.enabled ?? true },
      { onConflict: "url" },
    )
    .select("id, project_name, url, enabled")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, target: data });
}

/** DELETE: remove a target by url or id (?url= / ?id=). */
export async function DELETE(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const db = monitorServiceDb();
  if (!db) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 503 },
    );
  }

  const url = request.nextUrl.searchParams.get("url");
  const id = request.nextUrl.searchParams.get("id");
  if (!url && !id) {
    return NextResponse.json({ error: "Provide ?url= or ?id=" }, { status: 400 });
  }

  const query = db.from("monitor_targets").delete();
  const { error } = id ? await query.eq("id", id) : await query.eq("url", url as string);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Confirm current targets after delete.
  const targets = await listMonitorTargets(db, true);
  return NextResponse.json({ ok: true, remaining: targets.length });
}
