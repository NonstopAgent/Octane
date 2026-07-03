import { AUTH_COOKIE_VALUE } from "@/lib/auth/constants";

/**
 * Server-only session cookie value.
 * When OCTANE_SHARED_SECRET is set (always in production), the session cookie
 * carries a value derived from it — the legacy static "1" is only accepted in
 * bare dev environments with no secret configured.
 *
 * Edge-safe: string ops only (middleware runs on the edge runtime).
 */
export function expectedSessionCookieValue(): string {
  const secret = process.env.OCTANE_SHARED_SECRET?.trim();
  if (!secret || secret.startsWith("your-ultra-secure")) {
    return AUTH_COOKIE_VALUE; // dev fallback ("1")
  }
  return `os_${secret.slice(0, 40)}`;
}

export function isValidSessionCookie(value: string | undefined): boolean {
  if (!value) return false;
  const expected = expectedSessionCookieValue();
  if (value === expected) return true;
  // Never accept the legacy "1" once a real secret exists.
  return false;
}
