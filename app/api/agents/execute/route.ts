import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export type AgentAction =
  | { type: "github_list_prs"; repo: string }
  | { type: "github_list_issues"; repo: string; state?: "open" | "closed" | "all" }
  | { type: "github_create_issue"; repo: string; title: string; body: string; labels?: string[] }
  | { type: "vercel_list_deployments"; projectId?: string; teamId?: string }
  | { type: "vercel_list_projects" }
  | { type: "supabase_ping" };

export type AgentActionResult = {
  success: boolean;
  action: string;
  data?: unknown;
  error?: string;
  timestamp: string;
};

async function githubFetch(path: string, options?: RequestInit) {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function vercelFetch(path: string) {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not configured");
  const res = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function executeAction(action: AgentAction): Promise<AgentActionResult> {
  const timestamp = new Date().toISOString();

  try {
    switch (action.type) {
      case "github_list_prs": {
        const data = await githubFetch(`/repos/${action.repo}/pulls?state=open&per_page=10`);
        return {
          success: true,
          action: `List open PRs for ${action.repo}`,
          data: (data as { number: number; title: string; html_url: string; user: { login: string }; created_at: string }[]).map((pr) => ({
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            author: pr.user.login,
            createdAt: pr.created_at,
          })),
          timestamp,
        };
      }

      case "github_list_issues": {
        const state = action.state ?? "open";
        const data = await githubFetch(
          `/repos/${action.repo}/issues?state=${state}&per_page=10`,
        );
        return {
          success: true,
          action: `List ${state} issues for ${action.repo}`,
          data: (data as { number: number; title: string; html_url: string; user: { login: string }; labels: { name: string }[]; created_at: string }[]).map((issue) => ({
            number: issue.number,
            title: issue.title,
            url: issue.html_url,
            author: issue.user.login,
            labels: issue.labels.map((l) => l.name),
            createdAt: issue.created_at,
          })),
          timestamp,
        };
      }

      case "github_create_issue": {
        return {
          success: false,
          action: "Create GitHub issue",
          error:
            "Blocked: create issues only via approved Octane actions (/api/integrations/github/create-issue).",
          timestamp,
        };
      }

      case "vercel_list_deployments": {
        const params = new URLSearchParams();
        if (action.projectId) params.set("projectId", action.projectId);
        if (action.teamId) params.set("teamId", action.teamId);
        params.set("limit", "5");
        const data = await vercelFetch(`/v6/deployments?${params.toString()}`);
        return {
          success: true,
          action: "List recent Vercel deployments",
          data: (data as { deployments: { uid: string; name: string; url: string; state: string; createdAt: number }[] }).deployments?.map((d) => ({
            id: d.uid,
            name: d.name,
            url: d.url,
            state: d.state,
            createdAt: new Date(d.createdAt).toISOString(),
          })) ?? [],
          timestamp,
        };
      }

      case "vercel_list_projects": {
        const data = await vercelFetch("/v9/projects?limit=20");
        return {
          success: true,
          action: "List Vercel projects",
          data: (data as { projects: { id: string; name: string; framework: string; updatedAt: number }[] }).projects?.map((p) => ({
            id: p.id,
            name: p.name,
            framework: p.framework,
            updatedAt: new Date(p.updatedAt).toISOString(),
          })) ?? [],
          timestamp,
        };
      }

      case "supabase_ping": {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!url) throw new Error("Supabase URL not configured");
        const res = await fetch(`${url}/rest/v1/`, {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          },
        });
        return {
          success: res.ok,
          action: "Ping Supabase",
          data: { status: res.status, ok: res.ok },
          timestamp,
        };
      }

      default:
        return { success: false, action: "Unknown action", error: "Unknown action type", timestamp };
    }
  } catch (err) {
    return {
      success: false,
      action: action.type,
      error: err instanceof Error ? err.message : "Unknown error",
      timestamp,
    };
  }
}

export async function POST(req: NextRequest) {
  const unauthorized = requireApiAuth(req);
  if (unauthorized) return unauthorized;

  let body: { action: AgentAction; agentId: string };
  try {
    body = (await req.json()) as { action: AgentAction; agentId: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  const result = await executeAction(body.action);
  return NextResponse.json(result);
}
