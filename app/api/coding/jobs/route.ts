import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { generateCodingJobPlan } from "@/lib/coding/generate-plan";
import type { CodingJobMode } from "@/lib/types/coding-job";

export const runtime = "nodejs";

const MODES: CodingJobMode[] = ["review", "assisted", "autopilot"];

export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

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
  const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
  const repo = typeof data.repo === "string" ? data.repo.trim() : "";
  const modeRaw = typeof data.mode === "string" ? data.mode : "review";
  const mode = MODES.includes(modeRaw as CodingJobMode)
    ? (modeRaw as CodingJobMode)
    : "review";

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return NextResponse.json(
      { error: "repo must be owner/name format" },
      { status: 400 },
    );
  }
  if (mode === "autopilot") {
    return NextResponse.json(
      { error: "autopilot mode is disabled — use review or assisted" },
      { status: 400 },
    );
  }

  const projectName =
    typeof data.projectName === "string" ? data.projectName : undefined;

  const { plan, source } = await generateCodingJobPlan({
    prompt,
    repo,
    mode,
    projectName,
  });

  const title =
    typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : prompt.slice(0, 80);

  return NextResponse.json({
    title,
    plan,
    planSource: source,
    status: "pending_approval",
  });
}
