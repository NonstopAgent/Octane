import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import {
  PlaidError,
  plaidConfigured,
  plaidPost,
} from "@/lib/integrations/plaid-client";

export const runtime = "nodejs";

interface PlaidAccount {
  account_id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
}

/**
 * Exchange the public_token from Plaid Link for a long-lived access_token, and
 * return the linked accounts. NOTE: access_token is returned to the client and
 * persisted in the local (browser) store — acceptable for a single-founder
 * local-first MVP; move to server-side storage before multi-user.
 */
export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  if (!plaidConfigured()) {
    return NextResponse.json({ needsKeys: true }, { status: 200 });
  }

  let publicToken = "";
  try {
    const body = (await request.json()) as { public_token?: string };
    publicToken = body.public_token ?? "";
  } catch {
    publicToken = "";
  }
  if (!publicToken) {
    return NextResponse.json({ error: "public_token required" }, { status: 400 });
  }

  try {
    const exchanged = await plaidPost<{ access_token: string; item_id: string }>(
      "/item/public_token/exchange",
      { public_token: publicToken },
    );
    const accountsRes = await plaidPost<{
      accounts: PlaidAccount[];
      item: { institution_id?: string | null };
    }>("/accounts/get", { access_token: exchanged.access_token });

    let institution = "Bank";
    const institutionId = accountsRes.item?.institution_id;
    if (institutionId) {
      try {
        const inst = await plaidPost<{ institution: { name: string } }>(
          "/institutions/get_by_id",
          { institution_id: institutionId, country_codes: ["US"] },
        );
        institution = inst.institution?.name ?? institution;
      } catch {
        // non-fatal — keep default label
      }
    }

    return NextResponse.json({
      access_token: exchanged.access_token,
      item_id: exchanged.item_id,
      institution,
      accounts: accountsRes.accounts.map((a) => ({
        account_id: a.account_id,
        name: a.name,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
      })),
    });
  } catch (error) {
    const message =
      error instanceof PlaidError ? error.message : "Failed to link account";
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
