import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

/**
 * Cron routes verify `OCTANE_SHARED_SECRET` via this header (plain value, not Bearer).
 * Example: `curl -X POST http://localhost:3000/api/engineer/cron -H "x-octane-cron-secret: $OCTANE_SHARED_SECRET"`
 */
export const OCTANE_CRON_SECRET_HEADER = "x-octane-cron-secret";

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Returns true when the incoming header matches `OCTANE_SHARED_SECRET`. */
export function verifyOctaneCronSecret(request: NextRequest): boolean {
  const expected = process.env.OCTANE_SHARED_SECRET?.trim();
  if (!expected) return false;

  const incoming = request.headers.get(OCTANE_CRON_SECRET_HEADER)?.trim();
  if (!incoming) return false;

  return safeEqualStrings(incoming, expected);
}
