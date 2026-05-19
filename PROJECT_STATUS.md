# Octane Core — Project Status

## Stable base

| Item | Value |
|------|--------|
| Checkpoint | **10C** — Docs & QA (Executive Query Layer, hybrid auth) |
| Stack | Next.js 16, React 19, Zustand persist, Tailwind 4, Supabase client |
| Intelligence | Rule-based engines + optional Anthropic (`/chat`, cron briefing) |

## Feature list (shipped)

- **Hybrid auth** — Supabase sign-in/sign-up on `/login` + cookie gate via `/api/mock-auth/login` + middleware
- **Supabase sync** — pull on app load, push from Setup (`lib/supabase/sync.ts`)
- App shell (sidebar, topbar, command palette)
- Projects, tasks (kanban + DnD), decisions, roadmap, founder notes
- Inbox capture with convert-to-task/decision/note
- Finance ledger with metrics and weekly review money section
- Documents metadata + IP assets table
- Work sessions on Today
- **Morning briefing** (`/briefing`) — rule-based
- **Octane Advisor** — rule-based insights on dashboard, briefing, outlook
- **Octane Outlook** (`/outlook`) — strategic score, risks, 30/60/90, **Ask Octane** panel (`#ask-octane`)
- **Holdings** (`/holdings`) — entities, compliance, formation, legal questions
- **Executive Query Layer** (`lib/executive/`) — classify + answer + sensitive-topic guard (Ask Octane core)
- **Octane AI** (`/chat`) — optional Claude when `ANTHROPIC_API_KEY` set
- **Cron briefing** (`/api/cron/briefing`) — optional scheduled GitHub issue
- Dashboard metrics and Octane score
- Activity log, agents roster + logs/runs
- Settings: founder profile, entities, ownership map, export/import
- Command search across entities (includes outlook jump)
- Empty states, error boundary, current-week seed on reset

## Checkpoint 10C — documentation

- `VISION.md` — product principles, Ask Octane / Executive Query Layer, intelligence stack
- `README.md` — hybrid auth, routes (chat, outlook, holdings), executive categories, env vars
- Stale “mock-only auth / no Supabase” text removed

## QA checklist (10C — read-only)

Verified in repo at 10C doc pass:

| Check | Result | Notes |
|-------|--------|-------|
| `/outlook` route | **Pass** | `app/(app)/outlook/page.tsx`; linked from dashboard + command search |
| Executive engine | **Pass** | `lib/executive/` — `classifyExecutiveQuestion`, `generateExecutiveAnswer`, answer builders, `sensitive-topics.ts` |
| Zustand selector pattern | **Pass** | `useShallow(selectOctanePersistedState)` on dashboard, outlook, briefing, review, today, chat, holdings, command palette, advisor panel |
| Missing `ANTHROPIC_API_KEY` | **Pass** | `/api/chat` → `503` + `setup: true`; chat page shows `ApiSetupBanner`. Cron route → `503`. App shell and rule-based routes unaffected |
| Ask Octane UI (`/outlook#ask-octane`) | **Pass** | `AskOctanePanel` — chips, rule-based answer card, optional `executive_summary` narrative |
| Dashboard + command palette | **Pass** | Dashboard card → `/outlook#ask-octane`; palette shortcuts preserve hash |

## Known TODOs

- [ ] Pre-flight `ANTHROPIC_API_KEY` on Ask Octane panel (disable narrative button without a failed request)
- [ ] Persist all company profile fields to Supabase
- [ ] Real file storage for documents
- [ ] Sync conflict handling for multi-device edit
- [ ] E2E test suite in CI
- [ ] `vercel.json` cron schedule committed (if not already in deploy config)
- [ ] Middleware → proxy migration (Next 16) when trivial

## Do not build yet

- Destructive or auto-mutating “agent” actions against portfolio data without explicit user confirm
- Replacing rule-based executive answers with model-only responses (keep classify + builders as ground truth)
- Production secrets in the repo

## Next checkpoints

| Checkpoint | Focus |
|------------|--------|
| **11** | Executive Query UI + chat/rule hybrid routing |
| **12** | Agent execution hardening, holdings polish |
| **13** | Deployment hardening (Vercel envs, cron, monitoring) |

## Prior checkpoints (summary)

| Checkpoint | Focus |
|------------|--------|
| **7C** | Stability, polish, founder usability |
| **8–9** | Supabase schema, auth, sync layer |
| **10** | Outlook, holdings, advisor, executive engine, optional AI chat/cron |
