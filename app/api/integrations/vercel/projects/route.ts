import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { listProjects } from "@/lib/integrations/vercel-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const result = await listProjects(Number.isFinite(limit) ? limit : 20);
  return NextResponse.json(result);
}
