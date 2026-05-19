import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import {
  getOpenIssues,
  getOpenPullRequests,
  getRecentCommits,
  getRepo,
  getRepoSummary,
} from "@/lib/integrations/github-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const owner = request.nextUrl.searchParams.get("owner");
  const repoParam = request.nextUrl.searchParams.get("repo");
  const full = repoParam?.includes("/")
    ? repoParam
    : owner && repoParam
      ? `${owner}/${repoParam}`
      : null;

  if (!full || !full.includes("/")) {
    return NextResponse.json(
      { error: "Query owner and repo, or repo=owner/name" },
      { status: 400 },
    );
  }

  const view = request.nextUrl.searchParams.get("view") ?? "summary";

  if (view === "full") {
    const [detail, issues, pulls, commits] = await Promise.all([
      getRepo(full),
      getOpenIssues(full),
      getOpenPullRequests(full),
      getRecentCommits(full, 5),
    ]);
    if (!detail) {
      return NextResponse.json(
        { error: "Repository not found or token not configured", configured: false },
        { status: 404 },
      );
    }
    return NextResponse.json({ repo: detail, issues, pullRequests: pulls, commits });
  }

  const summary = await getRepoSummary(full);
  if (!summary) {
    return NextResponse.json(
      { error: "Repository not found or token not configured", configured: false },
      { status: 404 },
    );
  }

  const [issues, pullRequests] = await Promise.all([
    getOpenIssues(full, 5),
    getOpenPullRequests(full, 5),
  ]);

  return NextResponse.json({ ...summary, issues, pullRequests });
}
