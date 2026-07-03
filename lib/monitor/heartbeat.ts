import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Signal } from "@/lib/types/signal";

/**
 * Uptime heartbeats — ping monitored production URLs, persist history,
 * and emit signals when a target goes down.
 * Server-only (service role); no public policies on the tables.
 */

export type MonitorTarget = {
  id: string;
  project_name: string;
  url: string;
  enabled: boolean;
};

export type HeartbeatResult = {
  targetId: string;
  projectName: string;
  url: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error?: string;
};

export type TargetUptimeSummary = {
  targetId: string;
  projectName: string;
  url: string;
  enabled: boolean;
  lastOk: boolean | null;
  lastStatusCode: number | null;
  lastLatencyMs: number | null;
  lastCheckedAt: string | null;
  uptimePct24h: number | null;
  avgLatencyMs24h: number | null;
  checks24h: number;
  recent: Array<{ ok: boolean; latencyMs: number | null; checkedAt: string }>;
};

const PING_TIMEOUT_MS = 10_000;

export function monitorServiceDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function listMonitorTargets(
  db: SupabaseClient,
  includeDisabled = false,
): Promise<MonitorTarget[]> {
  let query = db
    .from("monitor_targets")
    .select("id, project_name, url, enabled")
    .order("project_name", { ascending: true });
  if (!includeDisabled) query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error) throw new Error(`monitor_targets read failed: ${error.message}`);
  return (data ?? []) as MonitorTarget[];
}

async function pingTarget(target: MonitorTarget): Promise<HeartbeatResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(target.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "octane-monitor/1.0 (+heartbeat)" },
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;
    // Reachable = server responded below 500. 401/403 count as up
    // (Vercel deployment protection responds 401 while healthy).
    return {
      targetId: target.id,
      projectName: target.project_name,
      url: target.url,
      ok: res.status < 500,
      statusCode: res.status,
      latencyMs,
    };
  } catch (err) {
    return {
      targetId: target.id,
      projectName: target.project_name,
      url: target.url,
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Ping every enabled target and persist one heartbeat row each. */
export async function runHeartbeats(db: SupabaseClient): Promise<HeartbeatResult[]> {
  const targets = await listMonitorTargets(db);
  if (targets.length === 0) return [];

  const results = await Promise.all(targets.map((t) => pingTarget(t)));

  const { error } = await db.from("project_heartbeats").insert(
    results.map((r) => ({
      target_id: r.targetId,
      ok: r.ok,
      status_code: r.statusCode,
      latency_ms: r.latencyMs,
      error: r.error ?? null,
    })),
  );
  if (error) {
    console.warn("[heartbeat] insert failed:", error.message);
  }
  return results;
}

/** Was this target already down on its previous check? (dedupe down-signals) */
export async function wasDownBefore(
  db: SupabaseClient,
  targetId: string,
): Promise<boolean> {
  const { data } = await db
    .from("project_heartbeats")
    .select("ok")
    .eq("target_id", targetId)
    .order("checked_at", { ascending: false })
    .range(1, 1);
  return data?.[0]?.ok === false;
}

export function buildDownSignal(result: HeartbeatResult): Signal {
  const now = new Date().toISOString();
  return {
    id: `sig-monitor-down-${result.projectName.replace(/[^a-zA-Z0-9-]/g, "-")}`,
    source: "system",
    type: "risk",
    title: `[Uptime] ${result.projectName} is DOWN`,
    summary: `${result.url} is unreachable${
      result.statusCode ? ` (HTTP ${result.statusCode})` : ""
    }${result.error ? ` — ${result.error}` : ""}. Latency at failure: ${result.latencyMs}ms.`,
    severity: "critical",
    status: "new",
    recommendedAction:
      "Check the Vercel deployment status and logs; redeploy or roll back if needed.",
    enrichedMetadata: {
      targetProjectSlug: result.projectName,
      monitor: "uptime",
      url: result.url,
      statusCode: result.statusCode ?? 0,
      alertEligible: true,
    },
    relatedRecordType: "monitor_target",
    relatedRecordId: result.targetId,
    isLive: true,
    isDerived: false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Uptime summary per target over the trailing 24h window. */
export async function summarizeUptime(
  db: SupabaseClient,
): Promise<TargetUptimeSummary[]> {
  const targets = await listMonitorTargets(db, true);
  if (targets.length === 0) return [];

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("project_heartbeats")
    .select("target_id, ok, status_code, latency_ms, checked_at")
    .gte("checked_at", since)
    .order("checked_at", { ascending: false })
    .limit(4000);
  if (error) throw new Error(`project_heartbeats read failed: ${error.message}`);

  type Row = {
    target_id: string;
    ok: boolean;
    status_code: number | null;
    latency_ms: number | null;
    checked_at: string;
  };
  const rows = (data ?? []) as Row[];
  const byTarget = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byTarget.get(row.target_id) ?? [];
    list.push(row);
    byTarget.set(row.target_id, list);
  }

  return targets.map((t) => {
    const list = byTarget.get(t.id) ?? [];
    const okCount = list.filter((r) => r.ok).length;
    const latencies = list
      .map((r) => r.latency_ms)
      .filter((v): v is number => typeof v === "number");
    const last = list[0];
    return {
      targetId: t.id,
      projectName: t.project_name,
      url: t.url,
      enabled: t.enabled,
      lastOk: last ? last.ok : null,
      lastStatusCode: last?.status_code ?? null,
      lastLatencyMs: last?.latency_ms ?? null,
      lastCheckedAt: last?.checked_at ?? null,
      uptimePct24h: list.length
        ? Math.round((okCount / list.length) * 1000) / 10
        : null,
      avgLatencyMs24h: latencies.length
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
      checks24h: list.length,
      recent: list.slice(0, 30).map((r) => ({
        ok: r.ok,
        latencyMs: r.latency_ms,
        checkedAt: r.checked_at,
      })),
    };
  });
}
