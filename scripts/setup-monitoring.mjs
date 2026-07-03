/**
 * One-shot monitoring setup (idempotent):
 *  1. Finds the Vercel project linked to this repo (NonstopAgent/Octane).
 *  2. Registers a Vercel deployment webhook (succeeded/error/canceled) for the
 *     Octane projects and captures the returned secret.
 *  3. Pushes all server env vars from .env.local to the Vercel project (prod+preview).
 *  4. Registers GitHub repo webhooks (push/PR/workflow_run/dependabot_alert)
 *     where the PAT has permission.
 *  5. Writes captured secrets back into .env.local.
 *
 * Run: node scripts/setup-monitoring.mjs
 */
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, ".env.local");
const REPO = "NonstopAgent/Octane";
// Live repos per Vercel project links: octane→Octane, octane-nexus-6em9→Octane_Nexus, octane-ajax→Octane_Ajax
const GITHUB_REPOS = ["NonstopAgent/Octane", "NonstopAgent/Octane_Nexus", "NonstopAgent/Octane_Ajax"];
const VERCEL_API = "https://api.vercel.com";
const GITHUB_API = "https://api.github.com";
const WEBHOOK_PATH = "/api/integrations/vercel/webhook";
const GH_WEBHOOK_PATH = "/api/integrations/github/webhook";

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function setEnvValue(text, key, value) {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) return text.replace(re, `${key}=${value}`);
  return `${text.trimEnd()}\n${key}=${value}\n`;
}

const envText = readFileSync(ENV_PATH, "utf8");
const env = parseEnv(envText);
const token = env.VERCEL_TOKEN;
const teamId = env.VERCEL_TEAM_ID;
const ghToken = env.GITHUB_TOKEN;
if (!token || !teamId) {
  console.error("VERCEL_TOKEN / VERCEL_TEAM_ID missing in .env.local");
  process.exit(1);
}

async function vercel(path, init = {}) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${VERCEL_API}${path}${sep}teamId=${encodeURIComponent(teamId)}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function github(path, init = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

const summary = [];
let envTextNext = envText;

// ── 1. Locate projects ───────────────────────────────────────────────────────
const projectsRes = await vercel("/v10/projects?limit=100");
if (!projectsRes.ok) {
  console.error("Failed to list Vercel projects:", projectsRes.status, JSON.stringify(projectsRes.body).slice(0, 300));
  process.exit(1);
}
const projects = projectsRes.body.projects ?? [];
const coreProject =
  projects.find((p) => `${p.link?.org}/${p.link?.repo}`.toLowerCase() === REPO.toLowerCase()) ??
  projects.find((p) => p.name === "octane");
if (!coreProject) {
  console.error("Could not find the Vercel project linked to", REPO);
  process.exit(1);
}
const octaneProjects = projects.filter((p) => p.name.startsWith("octane"));
summary.push(`Core project: ${coreProject.name} (${coreProject.id}); repo link: ${coreProject.link ? `${coreProject.link.org}/${coreProject.link.repo}` : "none"}`);
summary.push(`Octane projects for deploy webhook: ${octaneProjects.map((p) => p.name).join(", ")}`);

// Production URL: prefer shortest .vercel.app domain on the core project.
const domainsRes = await vercel(`/v9/projects/${coreProject.id}/domains`);
const domains = (domainsRes.body.domains ?? []).map((d) => d.name).filter((n) => n.endsWith(".vercel.app"));
domains.sort((a, b) => a.length - b.length);
const prodUrl = `https://${domains[0] ?? `${coreProject.name}-nonstopagents-projects.vercel.app`}`;
summary.push(`Production URL: ${prodUrl}`);

// ── 2. Vercel deployment webhook ─────────────────────────────────────────────
const hookUrl = `${prodUrl}${WEBHOOK_PATH}`;
const hooksRes = await vercel("/v1/webhooks");
const existingHook = (Array.isArray(hooksRes.body) ? hooksRes.body : hooksRes.body.webhooks ?? []).find(
  (w) => w.url === hookUrl,
);
if (existingHook) {
  summary.push(`Vercel webhook already registered (${existingHook.id}) — secret unchanged.`);
} else {
  const createRes = await vercel("/v1/webhooks", {
    method: "POST",
    body: JSON.stringify({
      url: hookUrl,
      events: ["deployment.succeeded", "deployment.error", "deployment.canceled"],
      projectIds: octaneProjects.map((p) => p.id),
    }),
  });
  if (createRes.ok && createRes.body.secret) {
    envTextNext = setEnvValue(envTextNext, "VERCEL_WEBHOOK_SECRET", createRes.body.secret);
    env.VERCEL_WEBHOOK_SECRET = createRes.body.secret;
    summary.push(`Vercel webhook created (${createRes.body.id}) → ${hookUrl}; secret captured into .env.local.`);
  } else {
    summary.push(`Vercel webhook creation FAILED (${createRes.status}): ${JSON.stringify(createRes.body).slice(0, 200)}`);
  }
}

// ── 3. GitHub webhooks ───────────────────────────────────────────────────────
if (!env.GITHUB_WEBHOOK_SECRET) {
  env.GITHUB_WEBHOOK_SECRET = randomBytes(32).toString("hex");
  envTextNext = setEnvValue(envTextNext, "GITHUB_WEBHOOK_SECRET", env.GITHUB_WEBHOOK_SECRET);
  summary.push("Generated GITHUB_WEBHOOK_SECRET into .env.local.");
}
const ghHookUrl = `${prodUrl}${GH_WEBHOOK_PATH}`;
for (const repo of GITHUB_REPOS) {
  const list = await github(`/repos/${repo}/hooks`);
  if (!list.ok) {
    summary.push(`GitHub webhook on ${repo}: SKIPPED (${list.status} — PAT lacks webhook/repo access).`);
    continue;
  }
  if ((list.body ?? []).some((h) => h.config?.url === ghHookUrl)) {
    summary.push(`GitHub webhook on ${repo}: already registered.`);
    continue;
  }
  const create = await github(`/repos/${repo}/hooks`, {
    method: "POST",
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["push", "pull_request", "workflow_run", "dependabot_alert"],
      config: { url: ghHookUrl, content_type: "json", secret: env.GITHUB_WEBHOOK_SECRET },
    }),
  });
  summary.push(
    create.ok
      ? `GitHub webhook on ${repo}: created (${create.body.id}).`
      : `GitHub webhook on ${repo}: FAILED (${create.status}): ${JSON.stringify(create.body).slice(0, 160)}`,
  );
}

// ── 4. Push env vars to the core Vercel project ──────────────────────────────
const PUSH_KEYS = [
  "ANTHROPIC_API_KEY",
  "GITHUB_TOKEN",
  "VERCEL_TOKEN",
  "VERCEL_TEAM_ID",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OCTANE_SHARED_SECRET",
  "CRON_SECRET",
  "VERCEL_WEBHOOK_SECRET",
  "GITHUB_WEBHOOK_SECRET",
  "SENTRY_WEBHOOK_SECRET",
  "WEBHOOK_ALERT_URL",
  "POSTHOG_API_KEY",
  "POSTHOG_PROJECT_ID",
  "POSTHOG_HOST",
  "POSTHOG_WEBHOOK_SECRET",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const payload = PUSH_KEYS.filter((k) => env[k]).map((key) => ({
  key,
  value: env[key],
  type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted",
  target: ["production", "preview"],
}));
payload.push({ key: "NEXT_PUBLIC_APP_URL", value: prodUrl, type: "plain", target: ["production", "preview"] });

const envRes = await vercel(`/v10/projects/${coreProject.id}/env?upsert=true`, {
  method: "POST",
  body: JSON.stringify(payload),
});
if (envRes.ok) {
  const failed = envRes.body.failed ?? [];
  summary.push(`Vercel env push: ${payload.length - failed.length}/${payload.length} vars upserted to ${coreProject.name} (production+preview).`);
  if (failed.length) summary.push(`  failed: ${failed.map((f) => f.error?.key ?? "?").join(", ")}`);
} else {
  summary.push(`Vercel env push FAILED (${envRes.status}): ${JSON.stringify(envRes.body).slice(0, 200)}`);
}

// ── 5. Persist .env.local updates ────────────────────────────────────────────
if (envTextNext !== envText) writeFileSync(ENV_PATH, envTextNext);

console.log("\n=== setup-monitoring summary ===");
for (const line of summary) console.log("• " + line);
