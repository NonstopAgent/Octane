/**
 * Opens PostHog-instrumentation PRs on the sibling Octane repos (review-first,
 * per VISION.md — no direct pushes to other repos).
 *
 * For each repo: finds the root layout (app router) or _document (pages router),
 * injects the official PostHog HTML snippet at the top of <body>, and opens a PR.
 *
 * Run: node scripts/instrument-posthog-remote.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env.local"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);

const REPOS = ["NonstopAgent/Octane_Nexus", "NonstopAgent/Octane_Ajax"];
const KEY = env.NEXT_PUBLIC_POSTHOG_KEY;
const BRANCH = "octane/posthog-instrumentation";
const CANDIDATES = [
  "app/layout.tsx",
  "src/app/layout.tsx",
  "app/layout.jsx",
  "src/app/layout.jsx",
  "pages/_document.tsx",
  "src/pages/_document.tsx",
];

if (!KEY || !env.GITHUB_TOKEN) {
  console.error("NEXT_PUBLIC_POSTHOG_KEY / GITHUB_TOKEN missing in .env.local");
  process.exit(1);
}

const SNIPPET_JS = `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${KEY}',{api_host:'https://us.i.posthog.com',ui_host:'https://us.posthog.com',defaults:'2025-05-24',capture_exceptions:true});`;

const INJECTION = `{/* PostHog analytics (Octane monitoring) */}\n        <script dangerouslySetInnerHTML={{ __html: \`${SNIPPET_JS.replace(/`/g, "\\`")}\` }} />`;

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

for (const repo of REPOS) {
  console.log(`\n── ${repo} ──`);
  const repoRes = await gh(`/repos/${repo}`);
  if (!repoRes.ok) {
    console.log(`  SKIP: cannot read repo (${repoRes.status})${repoRes.body.message ? ` — ${repoRes.body.message}` : ""}`);
    continue;
  }
  if (repoRes.body.archived) {
    console.log("  SKIP: repository is archived.");
    continue;
  }
  const defaultBranch = repoRes.body.default_branch;

  let target = null;
  for (const candidate of CANDIDATES) {
    const f = await gh(`/repos/${repo}/contents/${candidate}?ref=${defaultBranch}`);
    if (f.ok) {
      target = { path: candidate, sha: f.body.sha, content: Buffer.from(f.body.content, "base64").toString("utf8") };
      break;
    }
  }
  if (!target) {
    console.log("  SKIP: no root layout/_document found among candidates.");
    continue;
  }
  console.log(`  Layout: ${target.path} (default branch: ${defaultBranch})`);

  if (/posthog/i.test(target.content)) {
    console.log("  SKIP: PostHog already referenced in layout.");
    continue;
  }

  const bodyTag = target.content.match(/<body[^>]*>/);
  if (!bodyTag) {
    console.log("  SKIP: could not locate <body> tag in layout.");
    continue;
  }
  const updated = target.content.replace(bodyTag[0], `${bodyTag[0]}\n        ${INJECTION}`);

  // Branch from default head (reuse if it already exists).
  const head = await gh(`/repos/${repo}/git/ref/heads/${defaultBranch}`);
  const headSha = head.body.object?.sha;
  const refRes = await gh(`/repos/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: headSha }),
  });
  if (!refRes.ok && refRes.status !== 422) {
    console.log(`  FAILED creating branch (${refRes.status}): ${JSON.stringify(refRes.body).slice(0, 160)}`);
    continue;
  }

  const putRes = await gh(`/repos/${repo}/contents/${target.path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: "Add PostHog analytics snippet (Octane monitoring)",
      content: Buffer.from(updated, "utf8").toString("base64"),
      sha: target.sha,
      branch: BRANCH,
    }),
  });
  if (!putRes.ok) {
    console.log(`  FAILED committing file (${putRes.status}): ${JSON.stringify(putRes.body).slice(0, 160)}`);
    continue;
  }

  const prRes = await gh(`/repos/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: "Add PostHog analytics (Octane monitoring)",
      head: BRANCH,
      base: defaultBranch,
      body: [
        "Adds the PostHog snippet to the root layout so this app reports pageviews, exceptions, and web vitals into the **Octane Nexus** PostHog project (id 371612).",
        "",
        "- Public ingest token only (no secrets).",
        "- Feeds the usage/health view in Octane Core.",
        "",
        "Opened by Octane monitoring setup — review and merge to go live (merging triggers a Vercel deploy).",
      ].join("\n"),
    }),
  });
  if (prRes.ok) {
    console.log(`  PR opened: ${prRes.body.html_url}`);
  } else if (prRes.status === 422 && JSON.stringify(prRes.body).includes("already exists")) {
    console.log("  PR already exists for this branch.");
  } else {
    console.log(`  FAILED opening PR (${prRes.status}): ${JSON.stringify(prRes.body).slice(0, 160)}`);
  }
}
