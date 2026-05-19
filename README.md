# Octane Core

Octane Core is a **local-first founder operating system** for running multiple projects, bets, and entities from one command center. Data lives in your browser (Zustand + `localStorage`) until cloud sync ships — no Supabase, AI APIs, or external services in this build.

## Status

- **Checkpoint 7C** — stability, polish, founder usability
- **Persistence** — browser-only; export/import JSON snapshots
- **Auth** — mock login (any credentials) for local development

## Run locally

```bash
cd octane-core
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **mock login** on `/login` (any email/password) to reach the app shell.

Production build:

```bash
npm run build
npm start
```

## Dev workspace note (multiple lockfiles)

Next.js may warn about multiple `package-lock.json` files if a lockfile exists in a parent directory (e.g. `C:\Users\Logan A\package-lock.json`) as well as in `octane-core/`.

- **Do not delete** a parent lockfile unless you know it is unused by other projects.
- This repo sets `outputFileTracingRoot` and `turbopack.root` in `next.config.ts` to the `octane-core` directory so the dev server treats this folder as the workspace root.

## Routes & modules

| Route | Purpose |
|-------|---------|
| `/today` | Daily operating view — due work, blockers, work sessions |
| `/dashboard` | Portfolio health, Octane score, metrics |
| `/briefing` | Rule-based morning briefing |
| `/inbox` | Quick capture → convert to task/decision/note |
| `/projects` | Portfolio CRUD and detail |
| `/tasks` | Kanban with drag-and-drop |
| `/activity` | Audit-style activity feed |
| `/review` | Weekly review (Monday-start week) |
| `/agents` | Read-only agent roster (seeded) |
| `/finance` | Transactions, burn, runway |
| `/documents` | Document metadata + IP registry |
| `/decisions` | Decision log with reasoning |
| `/roadmap` | Now / next / later board + timeline |
| `/notes` | Founder notes |
| `/settings` | Profile, entities, export/import, shortcuts |

## Persistence

- **Store key** — `octane-core` in `localStorage`
- **Export JSON** — Settings → Data Management → Export JSON
- **Import JSON** — validates snapshot schema before replacing state
- **Reset demo data** — restores bundled seed (including current-week finance samples)
- **Clear local data** — wipes persist and reloads seed

Export regularly; there is no multi-device sync yet.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl + K` | Command palette (search) |
| **New** (top bar) | Create inbox item, task, decision, transaction, etc. |
| Sidebar | **Today**, **Inbox**, and other modules |
| Settings | **Export JSON** for backups |

Listed in Settings and in the command palette footer when empty.

## Limitations (by design)

- No Supabase, realtime sync, or multi-user auth
- No AI advisor or live agent execution
- File uploads are mocked (metadata only)
- Company profile fields in Settings are not persisted
- Holdings / external integrations not included

## Roadmap (future checkpoints)

- **Supabase** — auth, Postgres, RLS, sync
- **AI Advisor** — contextual recommendations
- **Holdings** — trust/entity capital views
- **Agents** — runnable agent logs and triggers
- **Vercel** — hosted deployment

See `PROJECT_STATUS.md` for checkpoint history and known TODOs.
