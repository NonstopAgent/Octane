import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import {
  PlaidError,
  plaidConfigured,
  plaidPost,
} from "@/lib/integrations/plaid-client";

export const runtime = "nodejs";

interface PlaidTxn {
  transaction_id: string;
  account_id: string;
  name: string;
  merchant_name: string | null;
  amount: number; // positive = money out of account (spend); negative = money in
  iso_currency_code: string | null;
  date: string;
  pending: boolean;
  personal_finance_category?: { primary?: string } | null;
  category?: string[] | null;
}

interface SyncResponse {
  added: PlaidTxn[];
  modified: PlaidTxn[];
  removed: { transaction_id: string }[];
  next_cursor: string;
  has_more: boolean;
}

function slim(t: PlaidTxn) {
  return {
    id: t.transaction_id,
    accountId: t.account_id,
    name: t.merchant_name || t.name,
    amount: t.amount,
    currency: t.iso_currency_code ?? "USD",
    date: t.date,
    pending: t.pending,
    category:
      t.personal_finance_category?.primary ??
      (Array.isArray(t.category) ? t.category[0] : undefined),
  };
}

/**
 * Pull new/updated transactions via Plaid /transactions/sync. Pass the last
 * cursor to fetch only the delta; omit it for a full first sync.
 */
export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  if (!plaidConfigured()) {
    return NextResponse.json({ needsKeys: true }, { status: 200 });
  }

  let accessToken = "";
  let cursor: string | undefined;
  try {
    const body = (await request.json()) as {
      access_token?: string;
      cursor?: string;
    };
    accessToken = body.access_token ?? "";
    cursor = body.cursor || undefined;
  } catch {
    accessToken = "";
  }
  if (!accessToken) {
    return NextResponse.json({ error: "access_token required" }, { status: 400 });
  }

  try {
    const added: ReturnType<typeof slim>[] = [];
    const modified: ReturnType<typeof slim>[] = [];
    const removed: string[] = [];
    let nextCursor = cursor;
    let hasMore = true;
    let guard = 0;

    while (hasMore && guard < 20) {
      guard += 1;
      const page = await plaidPost<SyncResponse>("/transactions/sync", {
        access_token: accessToken,
        ...(nextCursor ? { cursor: nextCursor } : {}),
        count: 250,
      });
      for (const t of page.added) added.push(slim(t));
      for (const t of page.modified) modified.push(slim(t));
      for (const r of page.removed) removed.push(r.transaction_id);
      nextCursor = page.next_cursor;
      hasMore = page.has_more;
    }

    return NextResponse.json({ added, modified, removed, cursor: nextCursor });
  } catch (error) {
    const message =
      error instanceof PlaidError ? error.message : "Failed to sync transactions";
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
