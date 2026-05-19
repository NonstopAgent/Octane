# Octane — Vision

Octane is a **founder operating system**: one command center for projects, bets, entities, money, ownership, and agents. The product optimizes for **clarity under load** — what to do today, what is blocked, what changed, and where strategic risk sits — without requiring you to open five tools.

## Principles

1. **Local-first, cloud-ready** — Zustand + browser persistence for speed; Supabase for identity and sync when configured.
2. **Rule-based first, AI-assisted second** — deterministic engines answer from your portfolio data; optional Claude paths (`/chat`, cron briefing) augment, never replace, ground truth in the store.
3. **Read-only intelligence** — advisors, outlook, briefings, and the Executive Query Layer recommend and explain. They do not mutate tasks, money, holdings, or documents.
4. **Planning, not professional advice** — legal, tax, investment, and compliance language triggers explicit warnings; outputs are for organizational planning only.

## Executive Query Layer (Ask Octane)

**Ask Octane** is the natural-language interface to Octane’s executive intelligence. At its core is the **Executive Query Layer** (`lib/executive/`):

- **Classify** — keyword scoring maps a question to one category (see below).
- **Answer** — category-specific builders synthesize a structured `ExecutiveAnswer` from the Zustand portfolio snapshot (projects, tasks, finance, holdings, agents, outlook, activity).
- **Guard** — sensitive-topic detection attaches a planning-only disclaimer for tax, legal, investment, and similar queries.

**Rule-based first:** `generateExecutiveAnswer()` runs entirely on local state — no network, no API keys, no side effects.

**AI-assisted second:** `/chat` (Octane AI) and `/api/cron/briefing` use Anthropic when `ANTHROPIC_API_KEY` is set. They are optional overlays for open-ended conversation and scheduled repo briefings, not required for core ops.

### Supported question categories

| Category | Example intents |
|----------|-----------------|
| `today` | Focus, briefing, top priorities |
| `blockers` | Stuck work, stale projects |
| `building` | Projects, roadmap, shipping pipeline |
| `money` | Burn, runway, revenue, expenses |
| `decisions` | Pending or overdue decisions |
| `changed` | Recent activity, what happened this week |
| `agents` | Agent status, errors, automation |
| `ownership` | Entities, holdings, IP, compliance gaps |
| `outlook` | 30/60/90 plan, strategic focus, pause/review |
| `risk` / `opportunity` | Downsides, bets, where to invest time |
| `improvement` | Weaker areas, what needs work |
| `unknown` | Fallback portfolio snapshot when no keywords match |

Related surfaces: **Morning Briefing** (`/briefing`), **Octane Advisor** (dashboard/briefing/outlook panels), **Octane Outlook** (`/outlook`), **Holdings** (`/holdings`).

## Layers of intelligence

| Layer | Route / module | Mode |
|-------|----------------|------|
| Morning Briefing | `/briefing` | Rule-based daily ops plan |
| Octane Advisor | Dashboard, briefing, outlook | Rule-based insights + suggested prompts |
| Octane Outlook | `/outlook` | Rule-based strategic score + horizons |
| Executive Query | `lib/executive` | Rule-based Q&A (Ask Octane core) |
| Octane AI | `/chat` | Optional Claude chat over portfolio context |
| Cron briefing | `/api/cron/briefing` | Optional scheduled GitHub issue (Vercel cron) |

## What Octane is not

- Not a law firm, CPA, or investment advisor.
- Not an autonomous agent that edits your ledger or deletes data.
- Not a replacement for export backups until sync conflict handling is production-grade.

See `README.md` for routes and run instructions; `PROJECT_STATUS.md` for checkpoint history and QA notes.
