# Octane Core — Project Status

## Stable base

| Item | Value |
|------|--------|
| Checkpoint | **12B** — Review-first source edit PR workflow |
| Stack | Next.js 16, React 19, Zustand persist, Tailwind 4, Supabase client |
| Intelligence | Rule-based engines + optional Anthropic (`/chat`, coding plans/edits, cron briefing) |

## Feature list (shipped)

- **Hybrid auth** — Supabase sign-in/sign-up on `/login` + cookie gate via `/api/mock-auth/login` + middleware
- **Supabase sync** — pull on app load (normalized), push from Setup (`lib/supabase/sync.ts`)
- **Data normalizer** — `lib/data/normalize-octane-data.ts` after sync, import, onboarding
- **Read-only GitHub connector** — `lib/integrations/github-client.ts`, `/api/integrations/github/*`, dashboard + project stats
- **Coding workbench (12A–12B)** — `/coding` with plan → approve → **generate/approve source edits** → source PR; planning PR (docs) retained; dashboard distinguishes PR kinds
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

## QA checklist (12B)

| Check | Result | Notes |
|-------|--------|-------|
| Repo clean at start | **Pass** | `master` @ `97d7569`, working tree clean |
| `npm run build` | **Run at commit** | Start + end |
| Types: editMode, proposedEdits, prKind | **Pass** | Normalized in store merge |
| `POST …/generate-edits` | **Pass** | Auth, no GitHub writes, Anthropic or fallback |
| `POST …/run-source-pr` | **Pass** | Requires `editApprovalStatus: approved` |
| Planning PR flow | **Pass** | `POST …/run` unchanged semantics + `prKind: planning` |
| UI: approve/reject/regenerate edits | **Pass** | Coding job card |
| Guardrails | **Pass** | `.env`, >5 files, package-lock, autopilot, branch names |
| Real PR in QA | **Needs env** | `GITHUB_TOKEN` + `ANTHROPIC_API_KEY` on server |
| Push to remote | **Skipped** | Per checkpoint instructions |

## QA checklist (12A)

| Check | Result | Notes |
|-------|--------|-------|
| Review mode default | **Pass** | UI + API reject autopilot |
| Ask Octane coding intent | **Pass** | Creates `CodingJob` + link `/coding?detail=` |
| Plan sections | **Pass** | understoodRequest, reviewItems, wontAutoHappen |
| No merge/deploy | **Pass** | Write client unchanged |

## Known TODOs

- [ ] OAuth flows for GitHub/Vercel (replace PAT env setup for founders)
- [ ] Pre-flight `ANTHROPIC_API_KEY` on Ask Octane panel
- [ ] Persist all company profile fields to Supabase
- [ ] Real file storage for documents
- [ ] Sync conflict handling for multi-device edit
- [ ] E2E test suite in CI
- [ ] Diff view / side-by-side editor for proposed edits

## Do not build yet

- Auto-merge PRs, deploy, rollback, or repo settings changes from Octane
- Mutating GitHub/Vercel APIs beyond approved coding workbench flow
- Storing integration tokens in Zustand or localStorage
- Production secrets in the repo

## Next checkpoints

| Checkpoint | Focus |
|------------|--------|
| **13** | Deployment hardening (Vercel envs, cron, monitoring) |

## Prior checkpoints (summary)

| Checkpoint | Focus |
|------------|--------|
| **12B** | Source-edit proposal + source PR after edit approval |
| **12A** | Coding workbench plan → planning PR |
| **11C** | GitHub coding workbench PR workflow |
| **11A** | Conversational commands, Connections placeholders, action approvals |
| **10** | Outlook, holdings, advisor, executive engine, optional AI chat/cron |
| **7C** | Stability, polish, founder usability |
