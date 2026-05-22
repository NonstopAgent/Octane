# Octane Core — Project Status

## Stable base

| Item | Value |
|------|--------|
| Checkpoint | **20B** — Sentry webhook ingest & hotfix action broker |
| Base commit | `af2032a` (20A finance valuation) |
| Stack | Next.js 16, React 19, Zustand persist, Tailwind 4, Supabase client |
| Intelligence | Rule-based engines + optional Anthropic (`/chat`, coding plans/edits, cron briefing) |

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
| **13** | Deployment hardening (Vercel envs, cron, monitoring) |

## Prior checkpoints (summary)

| Checkpoint | Focus |
|------------|--------|
| **12C** | Connector clarity, outlook layout, data mode, env audit |
| **12B** | Source-edit proposal + source PR after edit approval |
| **12A** | Coding workbench plan → planning PR |
| **11C** | GitHub coding workbench PR workflow |
| **11A** | Conversational commands, Connections, action approvals |
| **10** | Outlook, holdings, advisor, executive engine |
