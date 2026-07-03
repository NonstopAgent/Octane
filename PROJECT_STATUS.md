# Octane Core — Project Status

## Stable base

| Item | Value |
|------|--------|
| Checkpoint | **14** — Founder money-view + auth hardening (built on Checkpoint 13 monitoring base) |
| Base commit | `3faaa3f` (20B Sentry webhook ingest) |
| Stack | Next.js 16, React 19, Zustand persist, Tailwind 4, Supabase client |
| Intelligence | Rule-based engines + optional Anthropic (`/chat`, coding plans/edits, cron briefing) |

## Checkpoint 14 — Money-view + auth hardening (2026-07-03)

**Founder money-view** — the "how much did I put in, make, and spend" picture the whole app was missing.

| Area | Result |
|------|--------|
| Money In / Money Out | New all-time section on `/finance`: **You've Put In** (capital `investment` txns), **Total Made** (revenue), **Total Spent** (all expense-type outflows), **Net Position** (revenue − expenses, excludes your capital), **Ongoing Monthly** (recurring commitments). `lib/finance/metrics.ts`: `totalInvested`, `totalExpensesAllTime`, `netPosition`, `subscriptionRows`, `recurringMonthly` |
| Recurring model | `Transaction.recurring` + `cadence` ("monthly"/"yearly"); yearly normalized ÷12 for monthly cost |
| Recurring UI | Add-Transaction form now has a **Recurring commitment** checkbox + cadence selector (was missing — subscriptions were untrackable from the UI) |
| Ongoing Expenses table | Latest charge per subscription (keyed by category/notes), sorted by monthly cost |
| CSV import | Optional `recurring` + `cadence` columns supported (required schema unchanged: date, type, project, amount, notes) |
| Auth hardening | httpOnly signed session cookie (`lib/auth/session-secret.ts`, `mock-auth.ts`, `require-api-auth.ts`), server logout route `/api/mock-auth/logout`, `middleware.ts` gate |
| PostHog webhook | `/api/integrations/posthog/webhook` — error/exception alerts into the signal queue |
| Vercel import | `/api/integrations/vercel/import-candidates` + **Import from Vercel** button on Projects (pull real projects as monitor targets) |
| Signals history | `/api/signals/history` endpoint |
| Build | **Pass** (`next build`, exit 0 — all routes incl. `/finance` + new API routes; type-check clean) |
| Push | **Skipped** per checkpoint convention |

> Verification note: `npm run build *> log` returns a spurious exit 1 in the headless shell (broken stdout pipe under Turbopack). Run `node node_modules\next\dist\bin\next build` (or plain `npm run build` in a real terminal) — exit 0. A stale `next dev` also locks `.next` and blocks builds; stop it first.

## Checkpoint 13 — Live monitoring (2026-07-02)

| Area | Result |
|------|--------|
| Tokens | `GITHUB_TOKEN`, `VERCEL_TOKEN`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OCTANE_SHARED_SECRET`, `CRON_SECRET` set in `.env.local`; connectors verified live (GitHub as NonstopAgent, Vercel team-scoped) |
| Bug fix | `vercel-client.ts` never prepended `https://api.vercel.com` — connector could never work; fixed |
| Generic ingest | `lib/integrations/ingest-queue.ts` + `/api/integrations/ingest/pending` — one durable queue/drain for all sources (sentry, vercel, github, monitor) |
| Vercel webhook | `/api/integrations/vercel/webhook` — deployment succeeded/error/canceled → signals; HMAC via `VERCEL_WEBHOOK_SECRET`; prod failures dispatch server-side alerts |
| GitHub webhook | `/api/integrations/github/webhook` — push/PR/Dependabot/workflow_run → signals; HMAC via `GITHUB_WEBHOOK_SECRET`; critical/high Dependabot alerts dispatch |
| Client ingest | `useSignalIngest` (layout) polls drain every 60s, triggers heartbeats every 5 min while app open |
| Heartbeats | `monitor_targets` + `project_heartbeats` tables (applied); `/api/cron/heartbeat` pings prod URLs (down = critical signal + alert on up→down edge); `/api/monitor/heartbeats` 24h summary + target CRUD; 3 Octane prod apps seeded and verified UP |
| Health score | `lib/monitor/health-score.ts` (deploy 25 · signals 25 · uptime 20 · momentum 15 · reachability 15) + `/api/monitor/health` factors + badge on project cards |
| PostHog | `/api/integrations/posthog/usage` — 7d pageviews/visitors/exceptions, gated on `POSTHOG_API_KEY` + `POSTHOG_PROJECT_ID` |
| Supabase health | `/api/integrations/supabase/health` via `octane_db_health()` security-definer fn (applied); verified live (11.5 MB, queue depths) |
| Alerts | Dispatcher honors `enrichedMetadata.alertEligible`; webhook routes + heartbeat cron dispatch server-side (work with app closed) |
| Cron | `vercel.json`: daily heartbeat 06:00 + briefing 08:00 (Hobby-plan granularity; client interval covers intraday while app open) |
| Build | **Pass** (`npm run build`, exit 0) |
| Push | **Skipped** per checkpoint convention |

**Deployed + verified in production (2026-07-02):** master pushed → octane-lake.vercel.app deployed READY; all 12 env vars pushed via `scripts/setup-monitoring.mjs`; Vercel deploy webhook registered across all 3 Octane projects — the deploy itself fired `deployment.succeeded` into the durable queue (real delivery, HMAC-validated); forged unsigned webhook correctly rejected 401; prod heartbeat pinged all 3 apps UP from Vercel infra.

**PostHog live (2026-07-03):** octane-core instrumented via `instrumentation-client.ts` (posthog-js: pageviews, exceptions, web vitals); Nexus already had a PostHogProvider that was dark because `NEXT_PUBLIC_POSTHOG_KEY` was never set — env pushed to both sibling Vercel projects and Nexus redeployed; first real events captured in project 371612. Ajax instrumentation PR: `Octane_Ajax#2` (merge to go live). Live repo names are the underscore variants (`Octane_Nexus`, `Octane_Ajax`) — briefing route + setup script corrected; stale hyphen-repo webhook removed.

**Remaining manual:** GitHub webhook on `Octane_Nexus` still 403 ("resource not accessible") — add that repo to the PAT's repository list, rerun `node scripts/setup-monitoring.mjs`. Merge `Octane_Ajax#2`. `POSTHOG_API_KEY` (personal, read scope) for the in-app usage panel. Optional: `WEBHOOK_ALERT_URL`, Sentry webhook + secret.

## 12C summary

| Area | Result |
|------|--------|
| Env audit | `/api/integrations/env-audit` — server-only key presence, no values exposed |
| Connector errors | GitHub/Vercel status + project routes return sanitized messages (missing/invalid token, team scope, redeploy, project mismatch) |
| Vercel card | Configured/connected, team scope, last error, last checked, redeploy hint |
| Outlook UI | Reordered sections; detailed domain analysis in collapsible `<details>` |
| Data mode | Banner (Demo seed / Real workspace / Mixed) + Settings data-sources section |
| Project linking | Connect this project + Ask Octane CTAs; integration stats show API errors |
| Source PR proof | **Skipped** — `GITHUB_TOKEN` and `ANTHROPIC_API_KEY` empty in local `.env.local` |
| Build | **Pass** at commit time |
| Push | **Skipped** per checkpoint |

## Source PR proof-of-life (Phase 4)

**Target repo:** `NonstopAgent/Octane`  
**Prompt (not run):** simplify Outlook page layout per user spec  

**Blocker:** Local `.env.local` has `GITHUB_TOKEN=EMPTY` and `ANTHROPIC_API_KEY=EMPTY` (Supabase public keys only). Without server tokens the flow cannot reach GitHub to open a PR.

**To run manually when tokens are set:**

1. Set `GITHUB_TOKEN`, `ANTHROPIC_API_KEY`, optional `NEXT_PUBLIC_APP_URL` in `.env.local` or Vercel env; redeploy if on Vercel.
2. Link `NonstopAgent/Octane` (or `octane-core` path) to a project on Connections.
3. Coding → create job → generate edits → approve → **Run source PR**.

## Env audit (local, names only)

| Variable | Local `.env.local` | Scope |
|----------|-------------------|--------|
| `GITHUB_TOKEN` | missing | server |
| `VERCEL_TOKEN` | missing | server |
| `VERCEL_TEAM_ID` | missing | server |
| `ANTHROPIC_API_KEY` | missing | server |
| `NEXT_PUBLIC_APP_URL` | missing | public (optional) |
| `NEXT_PUBLIC_SUPABASE_*` | configured | public (expected) |

No integration secrets use `NEXT_PUBLIC_` prefix in code.

## Feature list (shipped)

- **Hybrid auth** — Supabase + mock cookie gate
- **Read-only GitHub / Vercel connectors** — hardened status messages
- **Coding workbench (12A–12B)** — review-first source edit PR workflow
- **Connections hub** — env audit panel, integration cards, project link form
- **Workspace data mode** — banner + Settings clarity (seed vs live vs mixed)
- **Octane Outlook** — simplified layout + Ask Octane (`#ask-octane`)
- **Action approvals** — review mode default; no auto-merge/deploy
- **Founder money-view** — capital in / revenue / spend / net position / recurring monthly burn on `/finance`
- App shell, projects, tasks, finance, holdings, briefing, optional AI chat/cron
- Settings: export/import, reset demo seed

## QA checklist (12C)

| Check | Result | Notes |
|-------|--------|-------|
| Repo clean at start | **Pass** | `master` @ `524f0af` |
| `npm run build` (start) | **Pass** | |
| `npm run build` (end) | **Pass** | After changes |
| Env audit API | **Pass** | No secret values in response |
| Vercel status errors | **Pass** | `lastError`, `teamScope`, `redeployHint` |
| Outlook section order | **Pass** | UI-only; `generateOctaneOutlook` unchanged |
| Data mode banner | **Pass** | Dismissible for demo seed |
| Secrets in client | **Pass** | Tokens only in API routes / server libs |
| Real source PR | **Skipped** | No `GITHUB_TOKEN` / `ANTHROPIC_API_KEY` locally |
| Push to remote | **Skipped** | Per instructions |

## Sentry webhook ingest (20B)

| Item | Detail |
|------|--------|
| Webhook | `POST /api/integrations/sentry/webhook` — validates `X-Sentry-Hook-Signature` when `SENTRY_WEBHOOK_SECRET` is set; dev mode logs a warning and accepts unsigned payloads when unset |
| Queue | **Preferred:** Supabase `signal_ingest_queue` (migration in `supabase/migrations/`) when `SUPABASE_SERVICE_ROLE_KEY` is set |
| Fallback | In-memory server queue + `GET /api/integrations/sentry/pending` (auth cookie) — **not durable** across Vercel/serverless cold starts |
| Client | `useSentryIngest` in app layout pulls queue → `upsertSignals` + `syncSignalActionProposals` (GitHub hotfix coding job) |

**Local test:** Sign in (mock auth cookie), POST a sample Sentry JSON to `/api/integrations/sentry/webhook`, reload app or call pending drain via layout mount.

## Known limitations

- OAuth for GitHub/Vercel not implemented (PAT env only)
- Sentry ingest memory queue is process-local; production should set `SUPABASE_SERVICE_ROLE_KEY` and apply `signal_ingest_queue` migration
- Source PR proof requires populated server env; not demonstrated in 12C QA
- Vercel project links match by **project name** — must match Vercel dashboard under current token/team
- Demo portfolio seed remains default until user resets or imports data

## Do not build yet

- Auto-merge PRs, deploy, rollback, or repo settings changes from Octane
- Storing integration tokens in Zustand or localStorage
- Production secrets in the repo

## Next checkpoints

| Checkpoint | Focus |
|------------|--------|
| **14** | Deploy hardening: Vercel envs set, webhooks registered, Sentry prod, PostHog key, alert channel |

## Prior checkpoints (summary)

| Checkpoint | Focus |
|------------|--------|
| **12C** | Connector clarity, outlook layout, data mode, env audit |
| **12B** | Source-edit proposal + source PR after edit approval |
| **12A** | Coding workbench plan → planning PR |
| **11C** | GitHub coding workbench PR workflow |
| **11A** | Conversational commands, Connections, action approvals |
| **10** | Outlook, holdings, advisor, executive engine |
