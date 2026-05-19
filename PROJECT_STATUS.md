# Octane Core — Project Status

## Stable base

| Item | Value |
|------|--------|
| Checkpoint | **11B** — Read-only GitHub + Vercel connectors |
| Stack | Next.js 16, React 19, Zustand persist, Tailwind 4, Supabase client |
| Intelligence | Rule-based engines + optional Anthropic (`/chat`, cron briefing) |

## Feature list (shipped)

- **Hybrid auth** — Supabase sign-in/sign-up on `/login` + cookie gate via `/api/mock-auth/login` + middleware
- **Supabase sync** — pull on app load (normalized), push from Setup (`lib/supabase/sync.ts`)
- **Data normalizer** — `lib/data/normalize-octane-data.ts` after sync, import, onboarding
- **Read-only GitHub connector** — `lib/integrations/github-client.ts`, `/api/integrations/github/*`, dashboard + project stats
- **Read-only Vercel connector** — `lib/integrations/vercel-client.ts`, `/api/integrations/vercel/*`, deployment health on dashboard
- **Connections hub** (`/connections`) — status, refresh, repo/project lists, project link form (validates via API)
- **Project links** — `projectConnections` in Zustand; live stats on project detail when linked
- **Action approvals** (`/actions`) — propose/approve/reject; chat & Ask Octane never auto-execute
- **Command parser** — connect github/vercel, check deployment, repos connected, missing github links (`parse-octane-command.ts`)
- **Optional setup** — skip to dashboard; chat-first onboarding CTAs
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
- Activity log (includes integration refresh + link create/update + validation fail)
- Settings: founder profile, entities, ownership map, export/import
- Command search across entities (includes outlook jump)
- Empty states, error boundary, current-week seed on reset

## QA checklist (11B)

| Check | Result | Notes |
|-------|--------|-------|
| Missing tokens | **Pass** | `configured: false`, no throw; UI shows “Token missing” |
| API auth | **Pass** | `requireApiAuth` on integration routes |
| No client secrets | **Pass** | Only `NEXT_PUBLIC_*` in client; tokens server-only |
| Read-only | **Pass** | GET-only integration routes; no deploy/delete |
| `npm run build` | **Run at commit** | Production compile |

## Known TODOs

- [ ] OAuth flows for GitHub/Vercel (replace PAT env setup for founders)
- [ ] Pre-flight `ANTHROPIC_API_KEY` on Ask Octane panel
- [ ] Persist all company profile fields to Supabase
- [ ] Real file storage for documents
- [ ] Sync conflict handling for multi-device edit
- [ ] E2E test suite in CI
- [ ] Middleware → proxy migration (Next 16) when trivial

## Do not build yet

- Mutating GitHub/Vercel APIs from Octane without explicit approval UI
- Storing integration tokens in Zustand or localStorage
- Production secrets in the repo

## Next checkpoints

| Checkpoint | Focus |
|------------|--------|
| **12** | Agent execution hardening, holdings polish |
| **13** | Deployment hardening (Vercel envs, cron, monitoring) |

## Prior checkpoints (summary)

| Checkpoint | Focus |
|------------|--------|
| **11A** | Conversational commands, Connections placeholders, action approvals |
| **10** | Outlook, holdings, advisor, executive engine, optional AI chat/cron |
| **7C** | Stability, polish, founder usability |
