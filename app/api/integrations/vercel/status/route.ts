import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { getAuthenticatedStatus } from "@/lib/integrations/vercel-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const status = await getAuthenticatedStatus();
  return NextResponse.json(status);
}
