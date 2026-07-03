# Octane — Monitoring Roadmap (Checkpoint 13+)

Goal: Octane actually monitors the portfolio. Today the pipes exist (connectors, signals, webhook ingest) but nothing real flows through them. This roadmap goes from "demo seed" to "Octane tells me what needs attention before I ask."

## Current state (audited 2026-07-02)

| Piece | Status |
|-------|--------|
| GitHub/Vercel read-only connectors | Built, **no tokens** — dead |
| Sentry webhook → signals | Built; `signal_ingest_queue` **now applied** to Supabase `Octane` (xrkqywmkbqqaadmfgqfc) |
| Engineer dispatch queue | `connected_projects` + `engineer_executions` **now applied** |
| Cron briefing → GitHub issue | Built, needs `ANTHROPIC_API_KEY` + `GITHUB_TOKEN` + `CRON_SECRET` |
| Real infra | Vercel `octane-nexus-6em9` (team `team_Mgxk3MibvMDnMEqb4TFmnVwC`); Supabase Octane / Octane Nexus / Octane Ajax all healthy; PostHog org "Octane Nexus" |
| `.env.local` | All server keys stubbed in, values empty (see Phase 0) |

## Phase 0 — Wire it ✅ DONE 2026-07-02

All four tokens set in `.env.local` + `OCTANE_SHARED_SECRET`/`CRON_SECRET` generated. Verified live: env audit green, GitHub connected (NonstopAgent), Vercel connected (team scope, real project list), Sentry webhook → Supabase durable queue (`channel: supabase`, test row confirmed). **Bug fixed during verification:** `vercel-client.ts` never prepended `https://api.vercel.com` to API paths — connector could never have worked; one-line fix in `vercelGet`. Remaining: set the same vars in Vercel project env before deploying; `ANTHROPIC_API_KEY` presence confirmed but not exercised (first `/chat` use will prove billing).

Original steps kept for reference:

1. **Vercel**: create token at vercel.com/account/tokens (scope: nonstopagent's projects) → `VERCEL_TOKEN`. `VERCEL_TEAM_ID` already filled in.
2. **GitHub**: fine-grained PAT at github.com/settings/personal-access-tokens — repos: `NonstopAgent/Octane` (+ any monitored repos); permissions: Contents + Metadata read, Issues read/write (briefing), Contents write only if using coding-PR flow → `GITHUB_TOKEN`.
3. **Supabase**: Dashboard → Octane project → Settings → API keys → copy `service_role` → `SUPABASE_SERVICE_ROLE_KEY`. Makes Sentry ingest durable (queue table is live).
4. **Anthropic**: console.anthropic.com → `ANTHROPIC_API_KEY` (chat, triage analysis, cron briefing).
5. Set the same vars in Vercel project env (Production) and redeploy.
6. **Verify**: `/connections` env-audit panel shows all green; link a real project by exact Vercel project name (`octane-nexus-6em9`).

Exit criteria: project cards show live deployments + repo stats; a test Sentry POST lands in Signals.

## Phase 1 — Real-time instead of polling ✅ BUILT 2026-07-02

Vercel + GitHub webhook routes live (HMAC-gated, dev-bypass when secret unset), generic ingest queue + 60s client drain. Verified end-to-end locally. Remaining: register the webhook URLs in Vercel/GitHub UIs after deploy, point Sentry at prod.

Original plan:

- **Vercel deploy webhooks** → new `/api/integrations/vercel/webhook`, reuse `signal_ingest_queue` (`source='vercel'`). Failed deploy = signal within seconds.
- **Sentry in production**: internal integration pointed at the deployed webhook URL, `SENTRY_WEBHOOK_SECRET` set.
- **GitHub webhooks** (push, PR, Dependabot alert) → same queue, `source='github'`. Kills polling and rate-limit worries.

The queue schema already supports this (`source` column) — one webhook route per provider, one shared drain.

## Phase 2 — Health score + uptime ✅ BUILT 2026-07-02

Heartbeats live (3 prod apps seeded, all UP), 24h uptime summaries, health score badge on project cards. Note: Vercel Hobby crons are daily — intraday pings run every 5 min while the app is open.

Original plan:

- **Uptime pings**: Vercel cron hits each linked project's prod URL every 5–15 min; store status/latency in a `project_heartbeats` table; sparkline + uptime % on project cards. No third-party service.
- **Project Health Score (0–100)** per project: deploy status (25) + open error signals (25) + uptime (20) + commit recency (15) + traffic trend (15). Dashboard sorts worst-first. This is the single biggest UX upgrade: raw stats → "what needs me."

## Phase 3 — Usage + infra depth ✅ BUILT 2026-07-02 (PostHog needs API key)

Supabase health live via `octane_db_health()`. PostHog route built, gated on `POSTHOG_API_KEY` + `POSTHOG_PROJECT_ID` (id 371612 prefilled in .env.local).

Original plan:

- **PostHog per project**: weekly actives, pageviews, error rate via PostHog API on each card. For a portfolio, "is anyone using this" is the most honest metric.
- **Supabase health**: per linked project — status, DB size, and Supabase advisor findings (security/perf lints) surfaced as signals.

## Phase 4 — Anomalies + delivery ✅ PARTIAL 2026-07-02

Delivery built: server-side critical alert dispatch from webhooks + heartbeat cron (works with app closed) once `WEBHOOK_ALERT_URL` is set; dispatcher honors `alertEligible` metadata. Staleness shows via Momentum factor in health score. Remaining: traffic-drop WoW rule (needs PostHog key + history).

Original plan:

- **Staleness rules**: active project, no commits 14d; traffic down >40% WoW; deploy pending >10 min.
- **Delivery**: critical signals → `WEBHOOK_ALERT_URL` (Discord/Slack); daily digest already exists via cron briefing → GitHub issue. Only interrupt for critical; everything else waits in the briefing.

## Env reference (server-only unless noted)

| Var | Used by | Status |
|-----|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | auth/store (public) | configured |
| `SUPABASE_SERVICE_ROLE_KEY` | durable queues | **needed** |
| `VERCEL_TOKEN` / `VERCEL_TEAM_ID` | deployments, status | token needed / filled |
| `GITHUB_TOKEN` | repo stats, pulse, issues, coding PRs | **needed** |
| `ANTHROPIC_API_KEY` | chat, triage, briefing | **needed** |
| `SENTRY_WEBHOOK_SECRET` | webhook HMAC | phase 1 |
| `CRON_SECRET` / `BRIEFING_REPO` | cron briefing | phase 1 |
| `WEBHOOK_ALERT_URL` | outbound alerts | phase 4 |
| `OCTANE_SHARED_SECRET` | Nexus/Ajax spoke HMAC | placeholder — rotate |

## Guardrails (unchanged from VISION.md)

Read-only intelligence; actions require approval; no tokens in client/Zustand; no auto-merge/deploy/rollback.
