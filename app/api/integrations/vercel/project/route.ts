import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { getDeployments, getProject } from "@/lib/integrations/vercel-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const name = request.nextUrl.searchParams.get("name");
  if (!name?.trim()) {
    return NextResponse.json({ error: "Query name is required" }, { status: 400 });
  }

  const project = await getProject(name.trim());
  if (!project) {
    return NextResponse.json(
      { error: "Project not found or token not configured", configured: false },
      { status: 404 },
    );
  }

  const includeDeployments =
    request.nextUrl.searchParams.get("deployments") === "1";
  const deployments = includeDeployments
    ? await getDeployments(project.id, 5)
    : undefined;

  return NextResponse.json({ project, deployments });
}
