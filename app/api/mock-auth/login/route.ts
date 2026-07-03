import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { expectedSessionCookieValue } from "@/lib/auth/session-secret";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const runtime = "nodejs";

/**
 * Session cookie issuance.
 * Production: requires a valid Supabase access token (validated server-side).
 * Development (NODE_ENV !== "production"): mock login allowed without a token.
 */
export async function POST(request: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";

  let accessToken: string | undefined;
  try {
    const body = (await request.json()) as { accessToken?: string };
    accessToken = body.accessToken?.trim() || undefined;
  } catch {
    accessToken = undefined;
  }

  if (isProd) {
    if (!accessToken) {
      return NextResponse.json(
        { error: "Sign in with your account to get a session." },
        { status: 401 },
      );
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!url || !anon) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }
    const supabase = createClient(url, anon);
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid or expired session token" }, { status: 401 });
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, expectedSessionCookieValue(), {
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: isProd,
  });

  return response;
}
