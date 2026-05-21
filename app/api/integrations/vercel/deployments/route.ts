import { NextRequest, NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/require-api-auth";
import { getLatestDeployment, getProject } from "@/lib/integrations/vercel-client";
import { dispatchCriticalAlertsForSignals } from "@/lib/notifications/dispatcher";
import {
  buildVercelDeploymentSignals,
  CORE_VERCEL_PROJECT_NAMES,
  mapOctaneProjectForVercelName,
  type VercelDeploymentProbe,
} from "@/lib/signals/vercel-deployment-signals";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";

type ProjectRef = { id: string; name: string; isCore?: boolean };

function parseProjectRefs(raw: string | null): ProjectRef[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((p): p is ProjectRef => Boolean(p && typeof p === "object" && "id" in p && "name" in p))
      .map((p) => ({
        id: String((p as ProjectRef).id),
        name: String((p as ProjectRef).name),
        isCore: (p as ProjectRef).isCore === true,
      }));
  } catch {
    return null;
  }
}

function resolveNames(request: NextRequest): string[] {
  const namesParam = request.nextUrl.searchParams.get("names");
  if (namesParam?.trim()) {
    return [
      ...new Set(
        namesParam
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean),
      ),
    ];
  }
  return [...CORE_VERCEL_PROJECT_NAMES];
}

export async function GET(request: NextRequest) {
  const unauthorized = requireApiAuth(request);
  if (unauthorized) return unauthorized;

  const configured = Boolean(process.env.VERCEL_TOKEN?.trim());
  if (!configured) {
    return NextResponse.json({
      signals: [],
      probes: [],
      configured: false,
      fetchedAt: new Date().toISOString(),
    });
  }

  const names = resolveNames(request);
  const projectRefs =
    parseProjectRefs(request.nextUrl.searchParams.get("projects")) ?? [];

  const probes: VercelDeploymentProbe[] = [];

  for (const name of names) {
    const result = await getProject(name);
    if (!result.project) {
      probes.push({ projectName: name, latestDeployment: null });
      continue;
    }
    const latest =
      result.project.latestDeployment ??
      (await getLatestDeployment(result.project.id));
    const octane = mapOctaneProjectForVercelName(name, projectRefs as Project[]);
    probes.push({
      projectName: name,
      projectId: result.project.id,
      octaneProjectId: octane?.id,
      octaneProjectName: octane?.name,
      latestDeployment: latest,
    });
  }

  const signals = buildVercelDeploymentSignals(probes);
  void dispatchCriticalAlertsForSignals(signals);

  return NextResponse.json({
    signals,
    probes: probes.map((p) => ({
      projectName: p.projectName,
      octaneProjectName: p.octaneProjectName,
      state: p.latestDeployment?.readyState ?? p.latestDeployment?.state ?? null,
    })),
    configured: true,
    fetchedAt: new Date().toISOString(),
  });
}
