import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import {
  PlaidError,
  plaidConfigured,
  plaidEnv,
  plaidPost,
} from "@/lib/integrations/plaid-client";

export const runtime = "nodejs";

/** Create a short-lived Plaid Link token the browser uses to open Plaid Link. */
export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  if (!plaidConfigured()) {
    return NextResponse.json({ needsKeys: true, env: plaidEnv() });
  }

  try {
    const data = await plaidPost<{ link_token: string; expiration: string }>(
      "/link/token/create",
      {
        user: { client_user_id: "octane-founder" },
        client_name: "Octane Core",
        products: ["transactions"],
        country_codes: ["US"],
        language: "en",
      },
    );
    return NextResponse.json({ link_token: data.link_token, env: plaidEnv() });
  } catch (error) {
    const message =
      error instanceof PlaidError ? error.message : "Failed to create link token";
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
