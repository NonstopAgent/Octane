/**
 * Non-destructive merge of local cache vs. cloud data.
 *
 * The old hydration replaced a whole collection with cloud data whenever cloud
 * had ≥1 row — so a stale/sparse cloud table could wipe local work. This merges
 * by id instead: union of both, and on a conflict the newer `updatedAt` wins.
 *
 * Limitation: without delete tombstones, an item deleted locally but still in
 * cloud can reappear once (until the delete re-propagates). That's an acceptable
 * trade for never silently losing data.
 */
export function mergeById<T extends { id: string; updatedAt?: string }>(
  local: T[],
  cloud: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const item of local ?? []) byId.set(item.id, item);
  for (const item of cloud ?? []) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    const localTime = existing.updatedAt ? Date.parse(existing.updatedAt) : 0;
    const cloudTime = item.updatedAt ? Date.parse(item.updatedAt) : 0;
    byId.set(item.id, cloudTime >= localTime ? item : existing);
  }
  return [...byId.values()];
}
