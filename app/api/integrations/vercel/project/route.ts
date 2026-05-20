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

  const result = await getProject(name.trim());
  if (!result.project) {
    return NextResponse.json(
      {
        error: result.error ?? "Project not found or token not configured",
        configured: Boolean(process.env.VERCEL_TOKEN?.trim()),
      },
      { status: 404 },
    );
  }

  const includeDeployments =
    request.nextUrl.searchParams.get("deployments") === "1";
  const deployments = includeDeployments
    ? await getDeployments(result.project.id, 5)
    : undefined;

  return NextResponse.json({ project: result.project, deployments });
}
