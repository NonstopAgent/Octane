import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { validateGenerateEditsRequest } from "@/lib/coding/edit-guardrails";
import { generateSourceEdits } from "@/lib/coding/generate-source-edits";
import type { CodingJob } from "@/lib/types/coding-job";

export const runtime = "nodejs";

const BLOCKED = [".env", "node_modules/", ".git/"];

function filterEdits(
  edits: NonNullable<CodingJob["proposedEdits"]>,
): NonNullable<CodingJob["proposedEdits"]> {
  return edits.filter((e) => {
    const path = e.path.replace(/\\/g, "/");
    if (BLOCKED.some((b) => path.includes(b) || path.startsWith(b))) return false;
    if (!e.afterContent?.trim()) return false;
    return true;
  });
}

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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON object" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const job = data.job as Partial<CodingJob> | undefined;

  if (!job || job.id !== id) {
    return NextResponse.json({ error: "job payload must match route id" }, { status: 400 });
  }

  const guard = validateGenerateEditsRequest({
    repo: job.repo ?? "",
    mode: job.mode ?? "review",
    prompt: job.prompt ?? "",
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: 400 });
  }

  if (job.mode === "autopilot") {
    return NextResponse.json({ error: "autopilot mode is disabled" }, { status: 400 });
  }

  const result = await generateSourceEdits({
    repo: job.repo!,
    prompt: job.prompt!,
    planSummary: job.plan?.summary,
    files: Array.isArray(job.proposedFiles) ? job.proposedFiles : undefined,
    ref: job.baseBranch,
  });

  const proposedEdits = filterEdits(result.proposedEdits).slice(0, 5);
  if (!proposedEdits.length) {
    return NextResponse.json(
      { error: "No valid edits generated — check repo paths and GITHUB_TOKEN" },
      { status: 422 },
    );
  }

  return NextResponse.json({
    id,
    editMode: "source_pr" as const,
    proposedFiles: proposedEdits.map((e) => e.path),
    proposedEdits,
    editApprovalStatus: "pending" as const,
    source: result.source,
    message: result.message,
    activityMessage: "Generated source edit proposal",
    updatedAt: new Date().toISOString(),
  });
}
