import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { listRepos } from "@/lib/integrations/github-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "30");
  const result = await listRepos(Number.isFinite(limit) ? limit : 30);
  return NextResponse.json(result);
}
