# Octane Core — Project Status

## Stable base

| Item | Value |
|------|--------|
| Checkpoint | **12A** — Coding workbench end-to-end loop |
| Stack | Next.js 16, React 19, Zustand persist, Tailwind 4, Supabase client |
| Intelligence | Rule-based engines + optional Anthropic (`/chat`, coding plans, cron briefing) |

## Feature list (shipped)

- **Hybrid auth** — Supabase sign-in/sign-up on `/login` + cookie gate via `/api/mock-auth/login` + middleware
- **Supabase sync** — pull on app load (normalized), push from Setup (`lib/supabase/sync.ts`)
- **Data normalizer** — `lib/data/normalize-octane-data.ts` after sync, import, onboarding
- **Read-only GitHub connector** — `lib/integrations/github-client.ts`, `/api/integrations/github/*`, dashboard + project stats
- **Coding workbench (12A)** — `/coding` with repo auto-fill, Ask Octane → `CodingJob` + plan API, richer plans/PR docs, dashboard “What Octane is doing”, project deep links
- **Read-only Vercel connector** — `lib/integrations/vercel-client.ts`, `/api/integrations/vercel/*`, deployment health on dashboard
- **Connections hub** (`/connections`) — status, refresh, repo/project lists, project link form (validates via API)
- **Project links** — `projectConnections` in Zustand; live stats on project detail when linked
- **Action approvals** (`/actions`) — propose/approve/reject; chat & Ask Octane never auto-execute (except direct coding job create from Ask Octane with plan)
- **Command parser** — connect github/vercel, coding intents → `codingJob` intent (not generic action), check deployment, repos connected (`parse-octane-command.ts`)
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

## QA checklist (12A)

| Check | Result | Notes |
|-------|--------|-------|
| Merge `feature/coding-workbench-11c` | **Already merged** | `master` and branch share HEAD `b5221d7` |
| Review mode default | **Pass** | UI + API reject autopilot |
| Ask Octane coding intent | **Pass** | Creates `CodingJob` + link `/coding?detail=` |
| Repo auto-fill | **Pass** | Project link + single-repo prefill + URL params |
| Plan sections | **Pass** | understoodRequest, reviewItems, wontAutoHappen |
| PR title/body | **Pass** | `Octane plan: …`, planning PR copy, `NEXT_PUBLIC_APP_URL` |
| No merge/deploy | **Pass** | Write client unchanged |
| Real PR in QA | **Needs GITHUB_TOKEN** | Run approve → Run on a test repo |
| `npm run build` | **Run at commit** | Production compile |

## QA checklist (11C)

| Check | Result | Notes |
|-------|--------|-------|
| Approve before run | **Pass** | `/run` returns 403 unless approved |
| GITHUB_TOKEN server-only | **Pass** | Write client reads `process.env` only |

## Known TODOs

- [ ] OAuth flows for GitHub/Vercel (replace PAT env setup for founders)
- [ ] Pre-flight `ANTHROPIC_API_KEY` on Ask Octane panel
- [ ] Persist all company profile fields to Supabase
- [ ] Real file storage for documents
- [ ] Sync conflict handling for multi-device edit
- [ ] E2E test suite in CI
- [ ] Implementation PRs (source edits) after planning PR review

## Do not build yet

- Auto-merge PRs, deploy, rollback, or repo settings changes from Octane
- Mutating GitHub/Vercel APIs beyond approved coding workbench flow
- Storing integration tokens in Zustand or localStorage
- Production secrets in the repo

## Next checkpoints

| Checkpoint | Focus |
|------------|--------|
| **12B** | Implementation commits after plan PR approval |
| **13** | Deployment hardening (Vercel envs, cron, monitoring) |

## Prior checkpoints (summary)

| Checkpoint | Focus |
|------------|--------|
| **11C** | GitHub coding workbench PR workflow |
| **11A** | Conversational commands, Connections placeholders, action approvals |
| **10** | Outlook, holdings, advisor, executive engine, optional AI chat/cron |
| **7C** | Stability, polish, founder usability |
