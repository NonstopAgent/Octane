import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const data = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const status = typeof data.status === "string" ? data.status : "";

  if (status && status !== "pending_approval" && status !== "approved") {
    return NextResponse.json(
      { error: "Job must be pending_approval to approve" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    id,
    status: "approved",
    approvedAt: new Date().toISOString(),
  });
}
