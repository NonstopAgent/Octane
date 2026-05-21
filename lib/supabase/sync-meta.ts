export const LAST_SUPABASE_SYNC_AT_KEY = "octane-last-supabase-sync-at";

export function recordSupabaseSyncSuccess(at: Date = new Date()): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_SUPABASE_SYNC_AT_KEY, at.toISOString());
}

export function getLastSupabaseSyncAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_SUPABASE_SYNC_AT_KEY);
}
