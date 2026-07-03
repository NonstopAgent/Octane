import { createHmac, timingSafeEqual } from "crypto";

import type { Signal, SignalSeverity } from "@/lib/types/signal";

/**
 * Vercel deployment webhook → Octane signal.
 * Vercel signs payloads with HMAC SHA1 (x-vercel-signature, hex of raw body).
 */

export type VercelWebhookExtract = {
  event: string;
  deploymentId: string;
  deploymentUrl: string;
  projectName: string;
  target: string;
  branch?: string;
  commitMessage?: string;
};

function safeCompareHex(expected: string, received: string): boolean {
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return expected === received;
  }
}

/** Validate x-vercel-signature (sha1 hex; sha256 accepted for forward-compat). */
export function verifyVercelSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.trim() || !secret.trim()) return false;
  const received = signatureHeader.trim().toLowerCase();
  const sha1 = createHmac("sha1", secret).update(rawBody, "utf8").digest("hex");
  if (safeCompareHex(sha1, received)) return true;
  const sha256 = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeCompareHex(sha256, received);
}

export function validateVercelWebhookRequest(opts: {
  rawBody: string;
  headers: Headers;
  secret: string | undefined;
}): { ok: true; devBypass?: boolean } | { ok: false; reason: string } {
  const secret = opts.secret?.trim();
  if (!secret) {
    console.warn(
      "[vercel-webhook] VERCEL_WEBHOOK_SECRET not set — accepting payload in dev mapping mode (unsigned).",
    );
    return { ok: true, devBypass: true };
  }
  const signature =
    opts.headers.get("x-vercel-signature") ?? opts.headers.get("X-Vercel-Signature");
  if (!signature) {
    return { ok: false, reason: "Missing x-vercel-signature header" };
  }
  if (!verifyVercelSignature(opts.rawBody, signature, secret)) {
    return { ok: false, reason: "Invalid Vercel webhook signature" };
  }
  return { ok: true };
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

const HANDLED_EVENTS = new Set([
  "deployment.succeeded",
  "deployment.ready",
  "deployment.error",
  "deployment.canceled",
]);

/** Parse a Vercel webhook body into a normalized extract; null = ignore event. */
export function parseVercelWebhookPayload(
  payload: unknown,
): VercelWebhookExtract | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const event = pickString(root.type);
  if (!HANDLED_EVENTS.has(event)) return null;

  const data = (root.payload ?? root) as Record<string, unknown>;
  const deployment = (data.deployment ?? {}) as Record<string, unknown>;
  const meta = (deployment.meta ?? {}) as Record<string, unknown>;
  const project = (data.project ?? {}) as Record<string, unknown>;

  const projectName = pickString(deployment.name, data.name, project.name, project.id);
  const deploymentId = pickString(deployment.id, data.deploymentId, root.id);
  if (!projectName && !deploymentId) return null;

  return {
    event,
    deploymentId: deploymentId || `unknown-${Date.now()}`,
    deploymentUrl: pickString(deployment.url, data.url),
    projectName: projectName || "unknown-project",
    target: pickString(data.target, deployment.target) || "production",
    branch: pickString(meta.githubCommitRef, meta.gitlabCommitRef) || undefined,
    commitMessage:
      pickString(meta.githubCommitMessage, meta.gitlabCommitMessage) || undefined,
  };
}

function deploySeverity(extract: VercelWebhookExtract): SignalSeverity {
  const failed = extract.event === "deployment.error";
  const canceled = extract.event === "deployment.canceled";
  if (failed) return extract.target === "production" ? "critical" : "high";
  if (canceled) return "medium";
  return "low";
}

export function buildVercelDeploySignal(extract: VercelWebhookExtract): Signal {
  const now = new Date().toISOString();
  const failed =
    extract.event === "deployment.error" || extract.event === "deployment.canceled";
  const severity = deploySeverity(extract);
  const verb =
    extract.event === "deployment.error"
      ? "failed"
      : extract.event === "deployment.canceled"
        ? "was canceled"
        : "succeeded";

  const commitPart = extract.commitMessage ? ` Commit: ${extract.commitMessage}.` : "";
  const branchPart = extract.branch ? ` Branch: ${extract.branch}.` : "";

  return {
    id: `sig-vercel-deploy-${extract.deploymentId.replace(/[^a-zA-Z0-9-]/g, "-")}`,
    source: "vercel",
    type: "deployment",
    title: failed
      ? `[Vercel] ${extract.target} deployment ${verb}: ${extract.projectName}`
      : `[Vercel] Deployment ${verb}: ${extract.projectName}`,
    summary: `${extract.projectName} ${extract.target} deployment ${verb}.${branchPart}${commitPart}${
      extract.deploymentUrl ? ` URL: ${extract.deploymentUrl}` : ""
    }`,
    severity,
    status: failed ? "new" : "resolved",
    recommendedAction: failed
      ? "Open the Vercel deployment logs, identify the failing step, and redeploy."
      : undefined,
    enrichedMetadata: {
      targetProjectSlug: extract.projectName,
      deploymentId: extract.deploymentId,
      deploymentUrl: extract.deploymentUrl,
      target: extract.target,
      event: extract.event,
      alertEligible: severity === "critical",
    },
    relatedRecordType: "vercel_deployment",
    relatedRecordId: extract.deploymentId,
    isLive: true,
    isDerived: false,
    createdAt: now,
    updatedAt: now,
  };
}
