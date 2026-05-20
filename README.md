# Octane Core

Octane Core is a **founder operating system** for running multiple projects, bets, and entities from one command center. Portfolio data lives in **Zustand** (browser `localStorage` by default) with optional **Supabase** sync after sign-in. Intelligence layers are **rule-based first**; **Octane AI** (`/chat`) and **cron briefing** are optional when `ANTHROPIC_API_KEY` is configured.

## Status

- **Checkpoint 12A** — Coding workbench alive loop (Ask Octane → job → plan → PR; dashboard activity)
- **Checkpoint 11C** — GitHub coding workbench (`/coding`, plan → approve → PR; review mode default)
- **Checkpoint 11B** — Read-only GitHub + Vercel connectors (server tokens, `/connections`, project links)
- **Checkpoint 11A** — Conversational command layer, Connections hub, action approvals, data normalizer
- **Checkpoint 10C** — Executive Query Layer docs, hybrid auth, outlook/holdings/chat surfaces
- **Persistence** — local Zustand persist + JSON export/import; Supabase push/pull on login when configured
- **Auth** — Supabase email/password sign-in/sign-up, plus a **cookie gate** (`/api/mock-auth/login`) so middleware can protect app routes

## Run locally

```bash
cd octane-core
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. **Sign in or sign up** on `/login` (Supabase Auth — requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`).
2. On success, the app sets an **httpOnly-style session cookie** via `/api/mock-auth/login` and redirects to `/dashboard`.
3. **Setup is optional** — skip to enter Octane with empty states, or use `/setup` / Ask Octane to build your portfolio. No passwords for external services; OAuth placeholders only.

Production build:

```bash
npm run build
npm start
```

### Optional: Octane AI and cron briefing

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Powers `/chat` and `/api/cron/briefing` |
| `GITHUB_TOKEN` | GitHub read integrations + coding workbench (branch/docs PR; server-only) |
| `VERCEL_TOKEN` | Read-only Vercel project/deployment status |
| `VERCEL_TEAM_ID` | Optional team scope for Vercel API |
| `NEXT_PUBLIC_APP_URL` | Optional absolute app URL for server-generated links |
| `CRON_SECRET` | Bearer token for Vercel Cron → `/api/cron/briefing` |

Without integration tokens, `/connections` and project link validation return **configured: false** — the app does not crash. Tokens are **never** sent to the browser or Zustand.

### Read-only integrations (11B)

| API | Purpose |
|-----|---------|
| `GET /api/integrations/github/status` | Token configured + user reachable |
| `GET /api/integrations/github/repos` | List repos (read-only) |
| `GET /api/integrations/github/repo?repo=owner/name` | Repo summary, issues, PRs, commits |
| `GET /api/integrations/vercel/status` | Token configured + user reachable |
| `GET /api/integrations/vercel/projects` | List projects |
| `GET /api/integrations/vercel/project?name=…` | Project + latest deployment |

All integration routes require the auth cookie. No deploy, delete, or settings mutations.

### Coding workbench (11C)

| API | Purpose |
|-----|---------|
| `POST /api/coding/jobs` | Generate plan (Anthropic or deterministic fallback) |
| `POST /api/coding/jobs/[id]/approve` | Record approval (client holds job state) |
| `POST /api/coding/jobs/[id]/run` | Approved jobs only: branch → `docs/octane-coding-jobs/<id>.md` → open PR (never merge) |

Jobs live in Zustand (`codingJobs`). Default mode is **review**; **autopilot** is disabled in UI and API.

Without `ANTHROPIC_API_KEY`, the app **does not crash** — `/chat` shows a setup banner; the cron route returns `503`. Core modules (Today, Outlook, Briefing, Holdings) work without any AI keys.

## Dev workspace note (multiple lockfiles)

Next.js may warn about multiple `package-lock.json` files if a lockfile exists in a parent directory (e.g. `C:\Users\Logan A\package-lock.json`) as well as in `octane-core/`.

- **Do not delete** a parent lockfile unless you know it is unused by other projects.
- This repo sets `outputFileTracingRoot` and `turbopack.root` in `next.config.ts` to the `octane-core` directory so the dev server treats this folder as the workspace root.

## Routes & modules

| Route | Purpose |
|-------|---------|
| `/today` | Daily operating view — due work, blockers, work sessions |
| `/dashboard` | Portfolio health, Octane score, advisor panel |
| `/outlook` | Strategic outlook — score, risks, 30/60/90 plan |
| `/briefing` | Rule-based morning briefing + advisor |
| `/chat` | **Octane AI** — optional Claude chat (“Ask Octane AI”) over portfolio context |
| `/universe` | Portfolio universe map (linked from dashboard) |
| `/inbox` | Quick capture → convert to task/decision/note |
| `/projects` | Portfolio CRUD and detail |
| `/tasks` | Kanban with drag-and-drop |
| `/activity` | Audit-style activity feed |
| `/review` | Weekly review (Monday-start week) |
| `/agents` | Agent roster, logs, and runs |
| `/finance` | Transactions, burn, runway |
| `/holdings` | Entities, compliance, formation, legal questions, IP ownership |
| `/documents` | Document metadata + IP registry |
| `/decisions` | Decision log with reasoning |
| `/roadmap` | Now / next / later board + timeline |
| `/notes` | Founder notes |
| `/connections` | GitHub/Vercel read-only status, refresh, project linking |
| `/actions` | Approve/reject proposed Octane actions |
| `/coding` | GitHub coding workbench — plan, approve, open PR (review mode) |
| `/settings` | Profile, entities, export/import, shortcuts |

## Ask Octane — Executive Query Layer

**Ask Octane** is the product name for natural-language questions over your portfolio. The **Executive Query Layer** (`lib/executive/`) implements it as pure, read-only logic:

1. **Classify** the question (`classifyExecutiveQuestion`) into a category via keyword scoring.
2. **Build** a structured answer (`generateExecutiveAnswer`) from store snapshots — no API calls, no mutations.
3. **Warn** on sensitive topics (tax, legal, investment, fundraising, etc.) with a planning-only disclaimer.

**Rule-based first:** briefing, advisor, outlook, and executive builders run on local Zustand state.

**AI-assisted second:** `/chat` streams Claude responses when configured; `/api/cron/briefing` can post a daily GitHub issue from live Ajax/Nexus repo data. Neither path deletes or edits portfolio records.

### Supported categories

`ownership` · `building` · `today` · `blockers` · `changed` · `decisions` · `money` · `agents` · `outlook` · `risk` · `opportunity` · `improvement` · `unknown`

See `VISION.md` for product principles and category examples.

## Auth (hybrid)

| Piece | Role |
|-------|------|
| **Supabase Auth** | Real sign-in/sign-up on `/login`; session used for sync and profile |
| **Cookie gate** | `POST /api/mock-auth/login` sets `AUTH_COOKIE_NAME`; middleware checks it for protected routes |
| **Sign out** | Clears Supabase session and cookie (`app-topbar`) |

Protected routes are listed in `lib/nav.ts` (`appRoutePrefixes`). `/setup` requires the cookie but is not in the main sidebar.

## Persistence

- **Store key** — `octane-core-storage` in `localStorage`
- **Supabase** — `loadFromSupabase()` on app layout when authenticated; `pushToSupabase()` from Setup
- **Export JSON** — Settings → Data Management → Export JSON
- **Import JSON** — validates snapshot schema before replacing state
- **Reset demo data** / **Clear local data** — Settings → Data Management

Export regularly until multi-device conflict handling is production-ready.

## Zustand selectors

Heavy views subscribe with **`useShallow(selectOctanePersistedState)`** to avoid re-renders when unrelated store slices change. The selector lives in `lib/store/octane-store.ts`. Granular `useOctaneStore((s) => s.field)` selectors are used on CRUD-heavy pages (Settings, Tasks, Documents).

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + K` | Command palette (search) |
| **New** (top bar) | Create inbox item, task, decision, transaction, etc. |
| Sidebar | **Today**, **Inbox**, and other modules |
| Settings | **Export JSON** for backups |

## Octane Outlook

**Octane Outlook** (`/outlook`) is a rule-based strategic intelligence layer: it scores execution, revenue, project quality, agent health, holdings, and strategic clarity, then surfaces opportunities, risks, blockers, and 30/60/90-day plans. All logic runs locally from your Zustand store. Scores and plans are **planning heuristics only**, not legal, tax, or investment advice.

## Holdings

**Holdings** (`/holdings`) consolidates entity map, asset/document ownership, compliance calendar, formation checklist, and legal questions — tied into outlook and executive **ownership** answers. Planning and tracking only.

## Limitations (by design)

- Executive answers and advisors are **read-only** (no auto-edits to tasks, finance, or holdings)
- File uploads remain metadata-only until object storage ships
- Company profile fields in Settings may not all persist to Supabase yet
- Executive Query UI may ship incrementally; the engine in `lib/executive/` is the source of truth for category behavior

## Roadmap

See `PROJECT_STATUS.md` for checkpoint history, QA notes, and known TODOs.
