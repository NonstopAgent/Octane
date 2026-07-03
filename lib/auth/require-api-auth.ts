import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { isValidSessionCookie } from "@/lib/auth/session-secret";

/** Returns 401 response when the session cookie is missing/invalid; otherwise null. */
export function requireApiAuth(request: NextRequest): NextResponse | null {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!isValidSessionCookie(cookie)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
