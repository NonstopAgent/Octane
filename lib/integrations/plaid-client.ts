/**
 * Minimal server-side Plaid client (no SDK dependency).
 * Reads credentials from env; never exposes them to the browser.
 *
 * Required env:
 *   PLAID_CLIENT_ID
 *   PLAID_SECRET
 *   PLAID_ENV = "sandbox" | "development" | "production"  (default sandbox)
 */

export type PlaidEnv = "sandbox" | "development" | "production";

export function plaidEnv(): PlaidEnv {
  const raw = (process.env.PLAID_ENV ?? "sandbox").toLowerCase();
  if (raw === "development" || raw === "production") return raw;
  return "sandbox";
}

export function plaidBaseUrl(): string {
  return `https://${plaidEnv()}.plaid.com`;
}

export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export class PlaidError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PlaidError";
  }
}

/** POST a Plaid endpoint with credentials injected. Returns parsed JSON. */
export async function plaidPost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    throw new PlaidError("Plaid is not configured (missing keys).", 400, "not_configured");
  }
  const res = await fetch(`${plaidBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = json as { error_message?: string; error_code?: string } | null;
    throw new PlaidError(
      err?.error_message ?? `Plaid request failed (${res.status})`,
      res.status,
      err?.error_code,
    );
  }
  return json as T;
}
