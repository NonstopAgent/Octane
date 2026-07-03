import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { fetchWithTimeout } from "@/lib/integrations/http";

export const runtime = "nodejs";

/**
 * PostHog usage snapshot (7d pageviews, unique visitors, total events).
 * Gated on POSTHOG_API_KEY (personal API key) + POSTHOG_PROJECT_ID.
 * Create a key at PostHog → Settings → Personal API Keys (read-only scope).
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const apiKey = process.env.POSTHOG_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const host = process.env.POSTHOG_HOST?.trim() || "https://us.posthog.com";

  if (!apiKey || !projectId) {
    return NextResponse.json({
      configured: false,
      message:
        "Set POSTHOG_API_KEY (personal API key) and POSTHOG_PROJECT_ID to enable usage stats.",
    });
  }

  try {
    const res = await fetchWithTimeout(
      `${host}/api/projects/${encodeURIComponent(projectId)}/query/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: {
            kind: "HogQLQuery",
            query: `
              select
                countIf(event = '$pageview') as pageviews7d,
                count(distinct person_id) as visitors7d,
                count() as events7d,
                countIf(event = '$exception') as exceptions7d
              from events
              where timestamp > now() - interval 7 day
            `,
          },
        }),
      },
      15_000,
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        {
          configured: true,
          connected: false,
          error: `PostHog query failed (HTTP ${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
        },
        { status: 502 },
      );
    }

    const data = (await res.json()) as { results?: unknown[][] };
    const row = data.results?.[0] ?? [];
    return NextResponse.json({
      configured: true,
      connected: true,
      windowDays: 7,
      pageviews: Number(row[0] ?? 0),
      visitors: Number(row[1] ?? 0),
      events: Number(row[2] ?? 0),
      exceptions: Number(row[3] ?? 0),
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        configured: true,
        connected: false,
        error: err instanceof Error ? err.message : "PostHog request failed",
      },
      { status: 502 },
    );
  }
}
