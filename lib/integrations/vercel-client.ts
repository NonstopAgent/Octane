import { fetchWithTimeout } from "@/lib/integrations/http";
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

async function vercelGet<T>(path: string): Promise<T | null> {
  const token = vercelToken();
  if (!token) return null;
  const res = await fetchWithTimeout(withTeam(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
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
  const token = vercelToken();
  if (!token) {
    return {
      provider: "vercel",
      configured: false,
      connected: false,
      message: "VERCEL_TOKEN not configured on server",
      checkedAt: at,
    };
  }

  const user = await vercelGet<{ user: { username: string; name?: string } }>("/v2/user");
  if (!user?.user) {
    return {
      provider: "vercel",
      configured: true,
      connected: false,
      message: "Vercel token invalid or API unreachable",
      teamId: process.env.VERCEL_TEAM_ID,
      checkedAt: at,
    };
  }

  return {
    provider: "vercel",
    configured: true,
    connected: true,
    login: user.user.username,
    name: user.user.name ?? user.user.username,
    teamId: process.env.VERCEL_TEAM_ID,
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
    projects: (data?.projects ?? []).map(mapProject),
  };
}

export async function getProject(nameOrId: string): Promise<VercelProjectDetail | null> {
  const encoded = encodeURIComponent(nameOrId);
  const data = await vercelGet<Parameters<typeof mapProject>[0] & { link?: { url?: string } }>(
    `/v9/projects/${encoded}`,
  );
  if (!data) return null;
  const latest = await getLatestDeployment(data.id);
  return {
    ...mapProject(data),
    link: data.link?.url,
    latestDeployment: latest,
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

  return (data?.deployments ?? []).map(mapDeployment);
}

export async function getLatestDeployment(
  projectId: string,
): Promise<VercelDeploymentSummary | null> {
  const list = await getDeployments(projectId, 1);
  return list[0] ?? null;
}
