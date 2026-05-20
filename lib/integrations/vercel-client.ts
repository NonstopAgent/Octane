import { fetchWithTimeout } from "@/lib/integrations/http";
import {
  integrationRedeployHint,
  vercelProjectMismatchMessage,
  vercelTeamScopeMessage,
  vercelTokenInvalidMessage,
  vercelTokenMissingMessage,
} from "@/lib/integrations/integration-messages";
import type {
  IntegrationAuthStatus,
  VercelDeploymentSummary,
  VercelProjectDetail,
  VercelProjectSummary,
} from "@/lib/integrations/types";

const VERCEL_API = "https://api.vercel.com";

function checkedAt(): string {
  return new Date().toISOString();
}

function vercelToken(): string | null {
  const token = process.env.VERCEL_TOKEN?.trim();
  return token || null;
}

function teamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  return teamId ? `teamId=${encodeURIComponent(teamId)}` : "";
}

function withTeam(path: string): string {
  const q = teamQuery();
  if (!q) return path;
  return path.includes("?") ? `${path}&${q}` : `${path}?${q}`;
}

type VercelFetchResult<T> = {
  data: T | null;
  error?: string;
  status?: number;
};

async function vercelGet<T>(path: string): Promise<VercelFetchResult<T>> {
  const token = vercelToken();
  if (!token) return { data: null };
  const res = await fetchWithTimeout(withTeam(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = (await res.json()) as { error?: { message?: string }; message?: string };
      detail = body.error?.message ?? body.message;
    } catch {
      detail = undefined;
    }
    return {
      data: null,
      status: res.status,
      error: detail ?? `HTTP ${res.status}`,
    };
  }
  return { data: (await res.json()) as T };
}

function mapProject(raw: {
  id: string;
  name: string;
  framework?: string | null;
  updatedAt?: number;
  link?: { type: string; repo?: string; url?: string };
}): VercelProjectSummary {
  return {
    id: raw.id,
    name: raw.name,
    framework: raw.framework ?? null,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : null,
    url: raw.link?.url ?? null,
  };
}

function mapDeployment(raw: {
  uid: string;
  name: string;
  url?: string;
  state: string;
  readyState?: string;
  createdAt: number;
  target?: string;
}): VercelDeploymentSummary {
  const host = raw.url;
  return {
    id: raw.uid,
    name: raw.name,
    url: host ? (host.startsWith("http") ? host : `https://${host}`) : null,
    state: raw.state,
    readyState: raw.readyState,
    createdAt: new Date(raw.createdAt).toISOString(),
    target: raw.target,
  };
}

export async function getAuthenticatedStatus(): Promise<IntegrationAuthStatus> {
  const at = checkedAt();
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || undefined;
  const teamScope = vercelTeamScopeMessage(teamId);
  const redeployHint = integrationRedeployHint();
  const token = vercelToken();
  if (!token) {
    return {
      provider: "vercel",
      configured: false,
      connected: false,
      message: vercelTokenMissingMessage(),
      teamScope,
      redeployHint,
      checkedAt: at,
    };
  }

  const user = await vercelGet<{ user: { username: string; name?: string } }>("/v2/user");
  if (!user.data?.user) {
    return {
      provider: "vercel",
      configured: true,
      connected: false,
      message: vercelTokenInvalidMessage(user.error),
      lastError: user.error,
      teamId,
      teamScope,
      redeployHint,
      checkedAt: at,
    };
  }

  return {
    provider: "vercel",
    configured: true,
    connected: true,
    login: user.data.user.username,
    name: user.data.user.name ?? user.data.user.username,
    teamId,
    teamScope,
    redeployHint,
    checkedAt: at,
  };
}

export async function listProjects(limit = 20): Promise<{
  configured: boolean;
  projects: VercelProjectSummary[];
}> {
  if (!vercelToken()) {
    return { configured: false, projects: [] };
  }

  const data = await vercelGet<{
    projects: Parameters<typeof mapProject>[0][];
  }>(`/v9/projects?limit=${Math.min(limit, 50)}`);

  return {
    configured: true,
    projects: (data.data?.projects ?? []).map(mapProject),
  };
}

export async function getProject(
  nameOrId: string,
): Promise<{ project: VercelProjectDetail | null; error?: string }> {
  const encoded = encodeURIComponent(nameOrId);
  const data = await vercelGet<Parameters<typeof mapProject>[0] & { link?: { url?: string } }>(
    `/v9/projects/${encoded}`,
  );
  if (!data.data) {
    const mismatch =
      data.status === 404
        ? vercelProjectMismatchMessage(nameOrId)
        : data.error
          ? vercelTokenInvalidMessage(data.error)
          : vercelProjectMismatchMessage(nameOrId);
    return { project: null, error: mismatch };
  }
  const latest = await getLatestDeployment(data.data.id);
  return {
    project: {
      ...mapProject(data.data),
      link: data.data.link?.url,
      latestDeployment: latest,
    },
  };
}

export async function getDeployments(
  projectId: string,
  limit = 5,
): Promise<VercelDeploymentSummary[]> {
  const params = new URLSearchParams({ projectId, limit: String(limit) });
  const team = teamQuery();
  if (team) params.set("teamId", process.env.VERCEL_TEAM_ID!.trim());

  const data = await vercelGet<{
    deployments: Parameters<typeof mapDeployment>[0][];
  }>(`/v6/deployments?${params.toString()}`);

  return (data.data?.deployments ?? []).map(mapDeployment);
}

export async function getLatestDeployment(
  projectId: string,
): Promise<VercelDeploymentSummary | null> {
  const list = await getDeployments(projectId, 1);
  return list[0] ?? null;
}
