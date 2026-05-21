import type { VercelDeploymentSummary } from "@/lib/integrations/types";
import type { ProjectConnection } from "@/lib/types";
import type { Project } from "@/lib/types";
import type { Signal, SignalSeverity } from "@/lib/types/signal";

/** Default Vercel project slugs for core Octane portfolio apps. */
export const CORE_VERCEL_PROJECT_NAMES = [
  "octane-ajax",
  "octane-nexus",
  "octane-core",
  "octane",
] as const;

export type VercelDeploymentProbe = {
  projectName: string;
  projectId?: string;
  octaneProjectId?: string;
  octaneProjectName?: string;
  latestDeployment: VercelDeploymentSummary | null;
};

function deploymentFailureState(dep: VercelDeploymentSummary): boolean {
  const state = (dep.readyState ?? dep.state).toUpperCase();
  return state === "ERROR" || state === "FAILED";
}

function sigId(projectName: string, deploymentId: string): string {
  return `sig-vercel-deployment-${projectName}-${deploymentId}`;
}

function makeDeploymentFailureSignal(opts: {
  projectName: string;
  octaneProjectId?: string;
  octaneProjectName?: string;
  deployment: VercelDeploymentSummary;
}): Signal {
  const displayName = opts.octaneProjectName ?? opts.projectName;
  const ts = opts.deployment.createdAt || new Date().toISOString();
  return {
    id: sigId(opts.projectName, opts.deployment.id),
    source: "vercel",
    type: "deployment",
    title: `[Vercel] Deployment Failure: ${displayName}`,
    summary: `Latest deployment for ${opts.projectName} is ${opts.deployment.readyState ?? opts.deployment.state}. ${opts.deployment.url ? `URL: ${opts.deployment.url}` : "Check Vercel logs for details."}`,
    severity: "critical",
    status: "new",
    projectId: opts.octaneProjectId,
    entityId: opts.deployment.id,
    relatedRecordType: "vercel_deployment",
    relatedRecordId: opts.deployment.id,
    recommendedAction: "Open /connections to verify the Vercel link and inspect deployment logs.",
    isLive: true,
    isDerived: false,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function buildVercelDeploymentSignals(probes: VercelDeploymentProbe[]): Signal[] {
  const signals: Signal[] = [];
  for (const probe of probes) {
    const dep = probe.latestDeployment;
    if (!dep || !deploymentFailureState(dep)) continue;
    signals.push(
      makeDeploymentFailureSignal({
        projectName: probe.projectName,
        octaneProjectId: probe.octaneProjectId,
        octaneProjectName: probe.octaneProjectName,
        deployment: dep,
      }),
    );
  }
  return signals;
}

/** Resolve Vercel project names from linked connections and core portfolio labels. */
export function resolveVercelProjectNames(
  projectConnections: ProjectConnection[],
  projects: Project[],
): string[] {
  const names = new Set<string>(CORE_VERCEL_PROJECT_NAMES);

  for (const conn of projectConnections) {
    if (conn.kind !== "vercel" || conn.status !== "linked") continue;
    const label = conn.label?.trim();
    if (label) names.add(label);
  }

  for (const project of projects.filter((p) => p.isCore)) {
    const slug = project.name
      .toLowerCase()
      .replace(/^octane\s+/i, "octane-")
      .replace(/\s+/g, "-");
    if (slug.startsWith("octane-")) names.add(slug);
  }

  return [...names];
}

export function mapOctaneProjectForVercelName(
  vercelName: string,
  projects: Project[],
): { id: string; name: string } | undefined {
  const normalized = vercelName.toLowerCase();
  return projects.find((p) => {
    const slug = p.name
      .toLowerCase()
      .replace(/^octane\s+/i, "octane-")
      .replace(/\s+/g, "-");
    return slug === normalized || normalized.includes(slug.replace("octane-", ""));
  });
}

export function rankSignalSeverity(severity: SignalSeverity): number {
  const order: SignalSeverity[] = ["critical", "high", "medium", "low"];
  return order.indexOf(severity);
}
