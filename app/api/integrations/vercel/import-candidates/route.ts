import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { fetchWithTimeout } from "@/lib/integrations/http";

export const runtime = "nodejs";

export type VercelImportCandidate = {
  name: string;
  framework: string | null;
  repo: string | null;
  prodUrl: string | null;
  updatedAt: string | null;
};

/**
 * Lists Vercel projects (with linked repo + stable prod domain) so the client
 * can import them as real Octane projects with connections.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const token = process.env.VERCEL_TOKEN?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token) {
    return NextResponse.json({ configured: false, candidates: [] });
  }

  const team = teamId ? `&teamId=${encodeURIComponent(teamId)}` : "";
  const res = await fetchWithTimeout(
    `https://api.vercel.com/v10/projects?limit=100${team}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    return NextResponse.json(
      { configured: true, candidates: [], error: `Vercel HTTP ${res.status}` },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    projects?: Array<{
      id: string;
      name: string;
      framework?: string | null;
      updatedAt?: number;
      link?: { org?: string; repo?: string };
    }>;
  };

  const candidates: VercelImportCandidate[] = await Promise.all(
    (data.projects ?? []).map(async (p) => {
      let prodUrl: string | null = null;
      try {
        const dRes = await fetchWithTimeout(
          `https://api.vercel.com/v9/projects/${p.id}/domains${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (dRes.ok) {
          const dData = (await dRes.json()) as { domains?: Array<{ name: string }> };
          const vercelDomains = (dData.domains ?? [])
            .map((d) => d.name)
            .filter((n) => n.endsWith(".vercel.app"))
            .sort((a, b) => a.length - b.length);
          prodUrl = vercelDomains[0] ? `https://${vercelDomains[0]}` : null;
        }
      } catch {
        prodUrl = null;
      }
      return {
        name: p.name,
        framework: p.framework ?? null,
        repo: p.link?.org && p.link?.repo ? `${p.link.org}/${p.link.repo}` : null,
        prodUrl,
        updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
      };
    }),
  );

  return NextResponse.json({
    configured: true,
    candidates,
    checkedAt: new Date().toISOString(),
  });
}
