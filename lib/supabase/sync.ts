/**
 * Octane ↔ Supabase sync layer
 *
 * Data lives in Zustand (localStorage) as the local cache.
 * Supabase is the source of truth per-user.
 *
 * Strategy:
 *   - On login  → loadFromSupabase()  → hydrate Zustand store
 *   - On logout → clearToBlank() in store
 *   - On setup complete → pushToSupabase()
 */

import { getSupabaseClient } from "./client";
import { recordSupabaseSyncSuccess } from "./sync-meta";
import type { OctanePersistedState } from "@/lib/store/octane-store";

// ─── helpers ────────────────────────────────────────────────────────────────

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getSupabaseClient() as any;
}

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await getSupabaseClient().auth.getUser();
  return user?.id ?? null;
}

// ─── PUSH: local store → Supabase ───────────────────────────────────────────

export async function pushToSupabase(
  state: Partial<OctanePersistedState>,
): Promise<{ ok: boolean; error?: string }> {
  const uid = await currentUserId();
  if (!uid) return { ok: false, error: "Not authenticated" };

  const client = db();

  try {
    const ops: Promise<{ error: { message: string } | null }>[] = [];

    // Profile
    if (state.profile) {
      ops.push(
        client
          .from("profiles")
          .upsert(
            {
              user_id: uid,
              name: state.profile.name,
              role: state.profile.role,
              email: state.profile.email,
              data: state.profile,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          )
          .then((r: { error: { message: string } | null }) => r),
      );
    }

    // Entities
    if (state.entities?.length) {
      ops.push(
        client
          .from("entities")
          .upsert(
            state.entities.map((e) => ({
              id: e.id,
              user_id: uid,
              name: e.name,
              type: e.type,
              status: e.status,
              data: e,
              updated_at: e.updatedAt,
              created_at: e.createdAt,
            })),
            { onConflict: "id" },
          )
          .then((r: { error: { message: string } | null }) => r),
      );
    }

    // Projects
    if (state.projects?.length) {
      ops.push(
        client
          .from("projects")
          .upsert(
            state.projects.map((p) => ({
              id: p.id,
              user_id: uid,
              name: p.name,
              status: p.status,
              priority: p.priority,
              data: p,
              updated_at: p.updatedAt,
              created_at: p.createdAt,
            })),
            { onConflict: "id" },
          )
          .then((r: { error: { message: string } | null }) => r),
      );
    }

    // Tasks
    if (state.tasks?.length) {
      ops.push(
        client
          .from("tasks")
          .upsert(
            state.tasks.map((t) => ({
              id: t.id,
              user_id: uid,
              title: t.title,
              status: t.status,
              priority: t.priority,
              project_id: t.projectId ?? null,
              data: t,
              updated_at: t.updatedAt,
              created_at: t.createdAt,
            })),
            { onConflict: "id" },
          )
          .then((r: { error: { message: string } | null }) => r),
      );
    }

    // Agents
    if (state.agents?.length) {
      ops.push(
        client
          .from("agents")
          .upsert(
            state.agents.map((a) => ({
              id: a.id,
              user_id: uid,
              name: a.name,
              status: a.status,
              data: a,
              updated_at: a.updatedAt,
              created_at: a.createdAt,
            })),
            { onConflict: "id" },
          )
          .then((r: { error: { message: string } | null }) => r),
      );
    }

    // Transactions
    if (state.transactions?.length) {
      ops.push(
        client
          .from("transactions")
          .upsert(
            state.transactions.map((t) => ({
              id: t.id,
              user_id: uid,
              type: t.type,
              amount: t.amount,
              project_id: t.projectId ?? null,
              data: t,
              transaction_date: t.transactionDate,
              created_at: t.createdAt,
            })),
            { onConflict: "id" },
          )
          .then((r: { error: { message: string } | null }) => r),
      );
    }

    // Decisions
    if (state.decisions?.length) {
      ops.push(
        client
          .from("decisions")
          .upsert(
            state.decisions.map((d) => ({
              id: d.id,
              user_id: uid,
              title: d.title,
              status: d.status,
              data: d,
              updated_at: d.updatedAt,
              created_at: d.createdAt,
            })),
            { onConflict: "id" },
          )
          .then((r: { error: { message: string } | null }) => r),
      );
    }

    // Documents
    if (state.documents?.length) {
      ops.push(
        client
          .from("documents")
          .upsert(
            state.documents.map((doc) => ({
              id: doc.id,
              user_id: uid,
              title: doc.name, // Document uses .name not .title
              data: doc,
              updated_at: doc.updatedAt,
              created_at: doc.createdAt,
            })),
            { onConflict: "id" },
          )
          .then((r: { error: { message: string } | null }) => r),
      );
    }

    // Founder Notes
    if (state.founderNotes?.length) {
      ops.push(
        client
          .from("founder_notes")
          .upsert(
            state.founderNotes.map((n) => ({
              id: n.id,
              user_id: uid,
              title: n.title,
              data: n,
              updated_at: n.updatedAt,
              created_at: n.createdAt,
            })),
            { onConflict: "id" },
          )
          .then((r: { error: { message: string } | null }) => r),
      );
    }

    // Roadmap items
    if (state.roadmapItems?.length) {
      ops.push(
        client
          .from("roadmap_items")
          .upsert(
            state.roadmapItems.map((item) => ({
              id: item.id,
              user_id: uid,
              title: item.title,
              data: item,
              updated_at: item.updatedAt,
              created_at: item.createdAt,
            })),
            { onConflict: "id" },
          )
          .then((r: { error: { message: string } | null }) => r),
      );
    }

    const results = await Promise.all(ops);
    const firstError = results.find((r) => r?.error);
    if (firstError?.error) {
      console.error("[sync] Push error:", firstError.error.message);
      return { ok: false, error: firstError.error.message };
    }

    recordSupabaseSyncSuccess();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[sync] Push failed:", msg);
    return { ok: false, error: msg };
  }
}

// ─── PULL: Supabase → local store ───────────────────────────────────────────

export interface SyncedState {
  profile: OctanePersistedState["profile"] | null;
  entities: OctanePersistedState["entities"];
  projects: OctanePersistedState["projects"];
  tasks: OctanePersistedState["tasks"];
  agents: OctanePersistedState["agents"];
  transactions: OctanePersistedState["transactions"];
  decisions: OctanePersistedState["decisions"];
  documents: OctanePersistedState["documents"];
  founderNotes: OctanePersistedState["founderNotes"];
  roadmapItems: OctanePersistedState["roadmapItems"];
  isEmpty: boolean;
}

export type LoadFromSupabaseResult =
  | { ok: true; data: SyncedState }
  | { ok: false; error: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseRowResponse = { data: any; error: { message: string } | null };

export async function loadFromSupabase(): Promise<LoadFromSupabaseResult> {
  const uid = await currentUserId();
  if (!uid) return { ok: false, error: "Not authenticated" };

  const client = db();

  try {
    const [
      profileRes,
      entitiesRes,
      projectsRes,
      tasksRes,
      agentsRes,
      transactionsRes,
      decisionsRes,
      documentsRes,
      notesRes,
      roadmapRes,
    ] = (await Promise.all([
      client.from("profiles").select("data").eq("user_id", uid).single(),
      client.from("entities").select("data").eq("user_id", uid),
      client.from("projects").select("data").eq("user_id", uid),
      client.from("tasks").select("data").eq("user_id", uid),
      client.from("agents").select("data").eq("user_id", uid),
      client.from("transactions").select("data").eq("user_id", uid),
      client.from("decisions").select("data").eq("user_id", uid),
      client.from("documents").select("data").eq("user_id", uid),
      client.from("founder_notes").select("data").eq("user_id", uid),
      client.from("roadmap_items").select("data").eq("user_id", uid),
    ])) as SupabaseRowResponse[];

    const tableErrors = [
      profileRes,
      entitiesRes,
      projectsRes,
      tasksRes,
      agentsRes,
      transactionsRes,
      decisionsRes,
      documentsRes,
      notesRes,
      roadmapRes,
    ]
      .map((res) => res.error?.message)
      .filter((msg): msg is string => Boolean(msg));

    if (tableErrors.length === 10) {
      const error = tableErrors[0] ?? "Supabase sync failed";
      console.error("[sync] Load failed:", error);
      return { ok: false, error };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unwrap = (res: SupabaseRowResponse): any[] => {
      if (res.error) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (res.data ?? []).map((row: { data: any }) => row.data).filter(Boolean);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = profileRes.error ? null : (profileRes.data as any)?.data ?? null;
    const entities = unwrap(entitiesRes);
    const projects = unwrap(projectsRes);
    const tasks = unwrap(tasksRes);
    const agents = unwrap(agentsRes);
    const transactions = unwrap(transactionsRes);
    const decisions = unwrap(decisionsRes);
    const documents = unwrap(documentsRes);
    const founderNotes = unwrap(notesRes);
    const roadmapItems = unwrap(roadmapRes);

    const isEmpty =
      !profile &&
      entities.length === 0 &&
      projects.length === 0 &&
      tasks.length === 0;

    recordSupabaseSyncSuccess();

    return {
      ok: true,
      data: {
        profile: profile as OctanePersistedState["profile"] | null,
        entities: entities as OctanePersistedState["entities"],
        projects: projects as OctanePersistedState["projects"],
        tasks: tasks as OctanePersistedState["tasks"],
        agents: agents as OctanePersistedState["agents"],
        transactions: transactions as OctanePersistedState["transactions"],
        decisions: decisions as OctanePersistedState["decisions"],
        documents: documents as OctanePersistedState["documents"],
        founderNotes: founderNotes as OctanePersistedState["founderNotes"],
        roadmapItems: roadmapItems as OctanePersistedState["roadmapItems"],
        isEmpty,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown sync error";
    console.error("[sync] Load failed:", msg);
    return { ok: false, error: msg };
  }
}

// ─── Check if user has completed setup ──────────────────────────────────────

export async function hasCompletedSetup(): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;

  const { data } = await db()
    .from("profiles")
    .select("name")
    .eq("user_id", uid)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !!(data as any)?.name;
}

// ─── Delete all user data (nuclear "Start Fresh") ───────────────────────────

export async function deleteAllUserData(): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;

  const client = db();
  const tables = [
    "tasks",
    "roadmap_items",
    "founder_notes",
    "documents",
    "decisions",
    "transactions",
    "agents",
    "projects",
    "entities",
    "profiles",
  ];

  await Promise.all(
    tables.map((t) => client.from(t).delete().eq("user_id", uid)),
  );
}
