import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

export const runtime = "nodejs";

/** Clears the httpOnly session cookie. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}
