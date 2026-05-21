import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { buildTriageMitigationProposal } from "@/lib/signals/propose-triage-mitigation";
import {
  analyzeSignalCluster,
  type TriageClusterRequest,
} from "@/lib/signals/triage-analysis";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  let body: TriageClusterRequest;
  try {
    body = (await request.json()) as TriageClusterRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.signals) || body.signals.length === 0) {
    return NextResponse.json(
      { error: "signals array required with at least one item" },
      { status: 400 },
    );
  }

  if (body.signals.length > 12) {
    return NextResponse.json(
      { error: "Maximum 12 signals per cluster" },
      { status: 400 },
    );
  }

  const cluster: TriageClusterRequest = {
    signals: body.signals.map((s) => ({
      id: String(s.id ?? ""),
      title: String(s.title ?? "Untitled"),
      source: s.source,
      summary: String(s.summary ?? s.description ?? ""),
      description: s.description ? String(s.description) : undefined,
      projectId: s.projectId ? String(s.projectId) : undefined,
      severity:
        s.severity === "critical" ||
        s.severity === "high" ||
        s.severity === "medium" ||
        s.severity === "low"
          ? s.severity
          : undefined,
    })),
  };

  const invalid = cluster.signals.some((s) => !s.id || !s.source);
  if (invalid) {
    return NextResponse.json(
      { error: "Each signal needs id, source, and title" },
      { status: 400 },
    );
  }

  const { analysis, source } = await analyzeSignalCluster(cluster);
  const proposedAction = buildTriageMitigationProposal(cluster, analysis);

  return NextResponse.json({
    analysis,
    source,
    configured: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    proposedAction,
  });
}
