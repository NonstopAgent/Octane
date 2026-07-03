import { createHmac, timingSafeEqual } from "crypto";

import type { Signal, SignalSeverity, SignalType } from "@/lib/types/signal";

/**
 * GitHub webhook → Octane signal.
 * GitHub signs payloads with HMAC SHA256: x-hub-signature-256 = "sha256=<hex>".
 * Handled events: push, pull_request, dependabot_alert, workflow_run, ping.
 */

export type GithubWebhookExtract = {
  event: string;
  repo: string;
  title: string;
  summary: string;
  severity: SignalSeverity;
  type: SignalType;
  dedupeId: string;
  alertEligible: boolean;
  htmlUrl?: string;
  resolved?: boolean;
};

export function verifyGithubSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.trim() || !secret.trim()) return false;
  const received = signatureHeader.trim().toLowerCase().replace(/^sha256=/, "");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return expected === received;
  }
}

export function validateGithubWebhookRequest(opts: {
  rawBody: string;
  headers: Headers;
  secret: string | undefined;
}): { ok: true; devBypass?: boolean } | { ok: false; reason: string } {
  const secret = opts.secret?.trim();
  if (!secret) {
    console.warn(
      "[github-webhook] GITHUB_WEBHOOK_SECRET not set — accepting payload in dev mapping mode (unsigned).",
    );
    return { ok: true, devBypass: true };
  }
  const signature =
    opts.headers.get("x-hub-signature-256") ?? opts.headers.get("X-Hub-Signature-256");
  if (!signature) {
    return { ok: false, reason: "Missing x-hub-signature-256 header" };
  }
  if (!verifyGithubSignature(opts.rawBody, signature, secret)) {
    return { ok: false, reason: "Invalid GitHub webhook signature" };
  }
  return { ok: true };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function repoName(root: Record<string, unknown>): string {
  const repo = root.repository as Record<string, unknown> | undefined;
  return str(repo?.full_name) || str(repo?.name) || "unknown-repo";
}

function shortRepo(full: string): string {
  return full.includes("/") ? full.split("/")[1] : full;
}

function dependabotSeverity(advisorySeverity: string): SignalSeverity {
  const s = advisorySeverity.toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "medium" || s === "moderate") return "medium";
  return "low";
}

/** Parse a GitHub webhook (event header + JSON body); null = ignore. */
export function parseGithubWebhookPayload(
  event: string,
  payload: unknown,
): GithubWebhookExtract | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const repo = repoName(root);
  const slug = shortRepo(repo);

  if (event === "push") {
    const ref = str(root.ref);
    const branch = ref.replace("refs/heads/", "");
    const head = root.head_commit as Record<string, unknown> | undefined;
    const message = str(head?.message).split("\n")[0];
    const pusher = str((root.pusher as Record<string, unknown> | undefined)?.name);
    const after = str(root.after);
    if (!after || after === "0000000000000000000000000000000000000000") return null;
    return {
      event,
      repo,
      title: `[GitHub] Push to ${slug}/${branch}`,
      summary: `${pusher || "Someone"} pushed to ${repo} (${branch}).${
        message ? ` Latest: ${message}` : ""
      }`,
      severity: "low",
      type: "progress",
      dedupeId: `push-${slug}-${after.slice(0, 12)}`,
      alertEligible: false,
      htmlUrl: str(head?.url),
      resolved: true,
    };
  }

  if (event === "pull_request") {
    const action = str(root.action);
    if (!["opened", "reopened", "closed", "ready_for_review"].includes(action)) {
      return null;
    }
    const pr = root.pull_request as Record<string, unknown> | undefined;
    const number = Number(root.number ?? pr?.number ?? 0);
    const title = str(pr?.title);
    const merged = Boolean(pr?.merged);
    const verb = action === "closed" ? (merged ? "merged" : "closed") : action;
    return {
      event,
      repo,
      title: `[GitHub] PR #${number} ${verb}: ${title || slug}`,
      summary: `Pull request #${number} ${verb} on ${repo}.${title ? ` "${title}"` : ""}`,
      severity: "low",
      type: "progress",
      dedupeId: `pr-${slug}-${number}-${verb}`,
      alertEligible: false,
      htmlUrl: str(pr?.html_url),
      resolved: action === "closed",
    };
  }

  if (event === "dependabot_alert") {
    const action = str(root.action);
    const alert = root.alert as Record<string, unknown> | undefined;
    const number = Number(alert?.number ?? 0);
    const advisory = alert?.security_advisory as Record<string, unknown> | undefined;
    const pkg = (alert?.dependency as Record<string, unknown> | undefined)
      ?.package as Record<string, unknown> | undefined;
    const severity = dependabotSeverity(str(advisory?.severity));
    const summaryText = str(advisory?.summary);
    const pkgName = str(pkg?.name);

    if (["fixed", "dismissed", "auto_dismissed"].includes(action)) {
      return {
        event,
        repo,
        title: `[GitHub] Dependabot alert ${action}: ${pkgName || `#${number}`} in ${slug}`,
        summary: `Dependabot alert #${number} (${pkgName}) ${action} on ${repo}.`,
        severity: "low",
        type: "risk",
        dedupeId: `dependabot-${slug}-${number}-${action}`,
        alertEligible: false,
        htmlUrl: str(alert?.html_url),
        resolved: true,
      };
    }
    if (!["created", "reintroduced", "reopened"].includes(action)) return null;
    return {
      event,
      repo,
      title: `[GitHub] ${severity.toUpperCase()} vulnerability: ${pkgName || "dependency"} in ${slug}`,
      summary: `Dependabot alert #${number} on ${repo}: ${summaryText || "security vulnerability detected"}${
        pkgName ? ` (package: ${pkgName})` : ""
      }.`,
      severity,
      type: "risk",
      dedupeId: `dependabot-${slug}-${number}`,
      alertEligible: severity === "critical" || severity === "high",
      htmlUrl: str(alert?.html_url),
    };
  }

  if (event === "workflow_run") {
    if (str(root.action) !== "completed") return null;
    const run = root.workflow_run as Record<string, unknown> | undefined;
    const conclusion = str(run?.conclusion);
    const name = str(run?.name);
    const branch = str(run?.head_branch);
    const runId = String(run?.id ?? "");
    if (conclusion !== "failure" && conclusion !== "timed_out") return null;
    return {
      event,
      repo,
      title: `[GitHub] CI ${conclusion === "timed_out" ? "timed out" : "failing"}: ${name || "workflow"} on ${slug}`,
      summary: `Workflow "${name}" ${conclusion} on ${repo} (${branch}).`,
      severity: "high",
      type: "risk",
      dedupeId: `workflow-${slug}-${runId}`,
      alertEligible: false,
      htmlUrl: str(run?.html_url),
    };
  }

  return null;
}

export function buildGithubSignal(extract: GithubWebhookExtract): Signal {
  const now = new Date().toISOString();
  return {
    id: `sig-github-${extract.dedupeId.replace(/[^a-zA-Z0-9-]/g, "-")}`,
    source: "github",
    type: extract.type,
    title: extract.title,
    summary: extract.summary,
    severity: extract.severity,
    status: extract.resolved ? "resolved" : "new",
    recommendedAction:
      extract.type === "risk" && !extract.resolved
        ? "Review on GitHub and remediate; Octane Engineer can draft a fix PR."
        : undefined,
    enrichedMetadata: {
      targetProjectSlug: shortRepo(extract.repo),
      repo: extract.repo,
      event: extract.event,
      htmlUrl: extract.htmlUrl ?? "",
      alertEligible: extract.alertEligible,
    },
    relatedRecordType: "github_event",
    relatedRecordId: extract.dedupeId,
    isLive: true,
    isDerived: false,
    createdAt: now,
    updatedAt: now,
  };
}
