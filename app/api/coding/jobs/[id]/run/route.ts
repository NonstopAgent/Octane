import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { runCodingJobOnGitHub } from "@/lib/coding/run-coding-job";
import type { CodingJob } from "@/lib/types/coding-job";

export const runtime = "nodejs";

function isApprovedJob(job: Partial<CodingJob>): boolean {
  return job.status === "approved";
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

  if (!isApprovedJob(job)) {
    return NextResponse.json(
      { error: "Job must be approved before run" },
      { status: 403 },
    );
  }

  if (job.mode === "autopilot") {
    return NextResponse.json(
      { error: "autopilot mode is disabled" },
      { status: 400 },
    );
  }

  if (!job.repo || !job.prompt) {
    return NextResponse.json({ error: "job.repo and job.prompt required" }, { status: 400 });
  }

  const fullJob: CodingJob = {
    id: job.id,
    title: job.title ?? "Coding job",
    prompt: job.prompt,
    repo: job.repo,
    mode: job.mode ?? "review",
    status: "running",
    projectId: job.projectId,
    plan: job.plan,
    changedFiles: Array.isArray(job.changedFiles) ? job.changedFiles : [],
    logs: Array.isArray(job.logs) ? job.logs : [],
    branchName: job.branchName,
    baseBranch: job.baseBranch,
    prNumber: job.prNumber,
    prUrl: job.prUrl,
    approvedAt: job.approvedAt,
    createdAt: job.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const result = await runCodingJobOnGitHub(fullJob);

  return NextResponse.json({
    id,
    ...result,
    updatedAt: new Date().toISOString(),
  });
}
