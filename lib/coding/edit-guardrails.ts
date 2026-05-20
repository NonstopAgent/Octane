import type { CodingJob, CodingJobProposedEdit } from "@/lib/types/coding-job";

import { MAX_SOURCE_EDIT_FILES } from "./discover-source-files";

export type EditGuardrailResult =
  | { ok: true }
  | { ok: false; error: string };

const BLOCKED_PREFIXES = [".env", ".env."];

function isBlockedPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  const base = normalized.split("/").pop() ?? normalized;
  if (BLOCKED_PREFIXES.some((p) => base === p || base.startsWith(p))) return true;
  if (normalized.includes("/.env")) return true;
  if (normalized.includes("node_modules")) return true;
  if (normalized.startsWith(".git/")) return true;
  return false;
}

export function validateProposedEditsForApply(
  job: Pick<CodingJob, "repo" | "mode" | "proposedEdits" | "editApprovalStatus">,
  edits: CodingJobProposedEdit[],
): EditGuardrailResult {
  if (!job.repo?.trim()) {
    return { ok: false, error: "Missing repository" };
  }
  if (job.mode === "autopilot") {
    return { ok: false, error: "Autopilot mode is disabled" };
  }
  if (job.editApprovalStatus !== "approved") {
    return { ok: false, error: "Source edits must be approved before opening a PR" };
  }
  if (!edits.length) {
    return { ok: false, error: "No proposed edits to apply" };
  }
  if (edits.length > MAX_SOURCE_EDIT_FILES) {
    return {
      ok: false,
      error: `At most ${MAX_SOURCE_EDIT_FILES} files per source PR`,
    };
  }

  const paths = new Set<string>();
  let hasPackageJson = false;
  let hasPackageLock = false;

  for (const edit of edits) {
    const path = edit.path.replace(/\\/g, "/").replace(/^\//, "");
    if (!path) {
      return { ok: false, error: "Edit path is required" };
    }
    if (paths.has(path)) {
      return { ok: false, error: `Duplicate path: ${path}` };
    }
    paths.add(path);

    if (isBlockedPath(path)) {
      return { ok: false, error: `Blocked path: ${path}` };
    }
    if (path === "package.json" || path.endsWith("/package.json")) {
      hasPackageJson = true;
    }
    if (path === "package-lock.json" || path.endsWith("/package-lock.json")) {
      hasPackageLock = true;
    }
    if (!edit.afterContent?.trim()) {
      return { ok: false, error: `Missing after content for ${path}` };
    }
  }

  if (hasPackageLock && !hasPackageJson) {
    return {
      ok: false,
      error: "package-lock.json changes require an intentional package.json edit",
    };
  }

  return { ok: true };
}

export function validateGenerateEditsRequest(
  job: Pick<CodingJob, "repo" | "mode" | "prompt">,
): EditGuardrailResult {
  if (!job.repo?.trim()) {
    return { ok: false, error: "Missing repository" };
  }
  if (job.mode === "autopilot") {
    return { ok: false, error: "Autopilot mode is disabled" };
  }
  if (!job.prompt?.trim()) {
    return { ok: false, error: "Missing prompt" };
  }
  return { ok: true };
}

/** Reject writes to default branch name (master/main) as target ref. */
export function assertFeatureBranch(branchName: string): EditGuardrailResult {
  const lower = branchName.toLowerCase();
  if (lower === "master" || lower === "main") {
    return { ok: false, error: "Cannot write directly to master/main" };
  }
  return { ok: true };
}
