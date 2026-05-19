import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, AUTH_COOKIE_VALUE } from "@/lib/auth/constants";

/** Returns 401 response when the session cookie is missing; otherwise null. */
export function requireApiAuth(request: NextRequest): NextResponse | null {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookie !== AUTH_COOKIE_VALUE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
