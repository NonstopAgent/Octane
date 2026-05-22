import { createClient } from "@supabase/supabase-js";

import type { SentryIngestPayload } from "./sentry-webhook";

export type QueuedSentryIngest = SentryIngestPayload & {
  queueId: string;
  enqueuedAt: string;
};

type MemoryEntry = QueuedSentryIngest;

/** Process-local queue — not durable across serverless cold starts. */
const memoryQueue: MemoryEntry[] = [];

function useServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Enqueue Sentry ingest for client-side Zustand merge (webhook cannot touch store). */
export async function enqueueSentryIngest(
  item: SentryIngestPayload,
): Promise<{ channel: "supabase" | "memory"; queueId: string }> {
  const queueId = `sq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const enqueuedAt = new Date().toISOString();

  if (useServiceRole()) {
    const db = serviceDb();
    if (db) {
      const { error } = await db.from("signal_ingest_queue").insert({
        id: queueId,
        source: "sentry",
        payload: item,
        created_at: enqueuedAt,
        consumed_at: null,
      });
      if (!error) {
        return { channel: "supabase", queueId };
      }
      console.warn("[sentry-ingest] Supabase insert failed, using memory:", error.message);
    }
  }

  memoryQueue.push({ ...item, queueId, enqueuedAt });
  return { channel: "memory", queueId };
}

/** Drain pending items (authenticated client pull). */
export async function drainSentryIngestQueue(): Promise<QueuedSentryIngest[]> {
  const drained: QueuedSentryIngest[] = [];

  if (useServiceRole()) {
    const db = serviceDb();
    if (db) {
      const { data, error } = await db
        .from("signal_ingest_queue")
        .select("id, payload, created_at")
        .eq("source", "sentry")
        .is("consumed_at", null)
        .order("created_at", { ascending: true })
        .limit(50);

      if (!error && data?.length) {
        const ids: string[] = [];
        for (const row of data) {
          const payload = row.payload as SentryIngestPayload | null;
          if (!payload?.signal) continue;
          drained.push({
            ...payload,
            queueId: String(row.id),
            enqueuedAt: String(row.created_at ?? new Date().toISOString()),
          });
          ids.push(String(row.id));
        }
        if (ids.length) {
          await db
            .from("signal_ingest_queue")
            .update({ consumed_at: new Date().toISOString() })
            .in("id", ids);
        }
        return drained;
      }
      if (error) {
        console.warn("[sentry-ingest] Supabase drain failed, falling back to memory:", error.message);
      }
    }
  }

  while (memoryQueue.length > 0) {
    const entry = memoryQueue.shift();
    if (entry) drained.push(entry);
  }

  return drained;
}

/** Whether durable Supabase queue is active (service role configured). */
export function sentryIngestUsesSupabase(): boolean {
  return useServiceRole();
}
