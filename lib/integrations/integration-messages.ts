/** User-facing integration hints — never include secret values. */

export function githubTokenMissingMessage(): string {
  return "GITHUB_TOKEN is not set on the server. Add it to .env.local or your Vercel project Environment Variables, then redeploy.";
}

export function githubTokenInvalidMessage(apiDetail?: string): string {
  const detail = sanitizeApiDetail(apiDetail);
  return detail
    ? `GitHub rejected the server token (${detail}). Generate a new fine-grained or classic PAT with repo read/write for coding jobs, update env, and redeploy.`
    : "GitHub token is invalid or expired. Update GITHUB_TOKEN in server env and redeploy.";
}

export function vercelTokenMissingMessage(): string {
  return "VERCEL_TOKEN is not set on the server. Add it to .env.local or Vercel Environment Variables, then redeploy.";
}

export function vercelTokenInvalidMessage(apiDetail?: string): string {
  const detail = sanitizeApiDetail(apiDetail);
  return detail
    ? `Vercel rejected the server token (${detail}). Create a new token at vercel.com/account/tokens, update env, and redeploy.`
    : "Vercel token is invalid or expired. Update VERCEL_TOKEN in server env and redeploy.";
}

export function vercelTeamScopeMessage(teamId: string | undefined): string {
  if (teamId?.trim()) {
    return `Team scope · VERCEL_TEAM_ID is set (projects and deployments are queried for that team).`;
  }
  return "Team scope · personal account (set VERCEL_TEAM_ID if projects live under a team).";
}

export function vercelProjectMismatchMessage(projectName: string): string {
  return `Vercel project "${projectName}" was not found for the current token/team. Confirm the project name in Connections matches Vercel exactly, or fix VERCEL_TEAM_ID.`;
}

export function integrationRedeployHint(): string {
  return "After changing env vars in Vercel, redeploy the app (Deployments → … → Redeploy) so the server picks up new tokens.";
}

function sanitizeApiDetail(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim().slice(0, 120);
  if (/token|bearer|sk-|ghp_|github_pat|vercel_/i.test(trimmed)) return undefined;
  return trimmed;
}
