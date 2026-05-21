import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { createGitHubIssue } from "@/lib/integrations/github-create-issue";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  let body: {
    repo?: string;
    title?: string;
    body?: string;
    labels?: string[];
    actionId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const repo = body.repo?.trim();
  const title = body.title?.trim();
  const issueBody = body.body?.trim() ?? "";

  if (!repo || !title) {
    return NextResponse.json(
      { error: "repo and title are required" },
      { status: 400 },
    );
  }

  const result = await createGitHubIssue({
    repo,
    title,
    body: issueBody,
    labels: body.labels,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    number: result.number,
    url: result.url,
    actionId: body.actionId,
    createdAt: new Date().toISOString(),
  });
}
