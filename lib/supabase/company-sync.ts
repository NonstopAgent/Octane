import { getSupabaseClient } from "./client";

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await getSupabaseClient().auth.getUser();
  return user?.id ?? null;
}

/** Push the company context (the AI's brain) to Supabase. No-ops without a session. */
export async function pushCompanyContext(content: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabaseClient() as any;
  await client
    .from("company_context")
    .upsert(
      { user_id: userId, content, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
}

export async function loadCompanyContext(): Promise<{
  content: string;
  updatedAt: string;
} | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getSupabaseClient() as any;
  const { data, error } = await client
    .from("company_context")
    .select("content, updated_at")
    .eq("user_id", userId)
    .single();
  if (error || !data?.content) return null;
  return {
    content: data.content as string,
    updatedAt: data.updated_at as string,
  };
}
