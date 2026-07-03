import { createClient } from "@supabase/supabase-js";

import type { OctaneAction } from "@/lib/types/octane-action";
import type { Signal } from "@/lib/types/signal";

/**
 * Generic webhook → client signal ingest queue (Supabase durable, memory fallback).
 * Generalizes the Sentry pattern so any source (vercel, github, monitor, …)
 * can enqueue signals for client-side Zustand merge.
 */

export type SignalIngestItem = {
  signal: Signal;
  actionProposal?: Omit<OctaneAction, "id" | "status" | "createdAt">;
  extracted?: unknown;
};

export type QueuedSignalIngest = SignalIngestItem & {
  queueId: string;
  source: string;
  enqueuedAt: string;
};

/** Process-local queue — not durable across serverless cold starts. */
const memoryQueue: QueuedSignalIngest[] = [];

function useServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Enqueue a signal for client-side merge (webhooks cannot touch the store). */
export async function enqueueSignalIngest(
  source: string,
  item: SignalIngestItem,
): Promise<{ channel: "supabase" | "memory"; queueId: string }> {
  const queueId = `sq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const enqueuedAt = new Date().toISOString();

  if (useServiceRole()) {
    const db = serviceDb();
    if (db) {
      const { error } = await db.from("signal_ingest_queue").insert({
        id: queueId,
        source,
        payload: item,
        created_at: enqueuedAt,
        consumed_at: null,
      });
      if (!error) {
        return { channel: "supabase", queueId };
      }
      console.warn(
        `[ingest-queue:${source}] Supabase insert failed, using memory:`,
        error.message,
      );
    }
  }

  memoryQueue.push({ ...item, queueId, source, enqueuedAt });
  return { channel: "memory", queueId };
}

/** Drain pending items across ALL sources (authenticated client pull). */
export async function drainSignalIngestQueue(): Promise<QueuedSignalIngest[]> {
  const drained: QueuedSignalIngest[] = [];

  if (useServiceRole()) {
    const db = serviceDb();
    if (db) {
      const { data, error } = await db
        .from("signal_ingest_queue")
        .select("id, source, payload, created_at")
        .is("consumed_at", null)
        .order("created_at", { ascending: true })
        .limit(100);

      if (!error && data) {
        const ids: string[] = [];
        for (const row of data) {
          const payload = row.payload as SignalIngestItem | null;
          if (!payload?.signal) continue;
          drained.push({
            ...payload,
            queueId: String(row.id),
            source: String(row.source ?? "unknown"),
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
      } else if (error) {
        console.warn(
          "[ingest-queue] Supabase drain failed, falling back to memory:",
          error.message,
        );
      }
    }
  }

  while (memoryQueue.length > 0) {
    const entry = memoryQueue.shift();
    if (entry) drained.push(entry);
  }

  return drained;
}
