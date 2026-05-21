import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { fetchPortfolioPulse } from "@/lib/integrations/portfolio-pulse";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const pulse = await fetchPortfolioPulse();
  return NextResponse.json(pulse, {
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
  });
}
