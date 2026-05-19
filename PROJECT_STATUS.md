# Octane Core — Project Status

## Stable base

| Item | Value |
|------|--------|
| Base commit (7C start) | `f875bcf` |
| Checkpoint | **7C** — Stability, Polish, Founder Usability |
| Stack | Next.js 16, React 19, Zustand persist, Tailwind 4 |

## Feature list (shipped)

- Mock auth gate and app shell (sidebar, topbar, command palette)
- Projects, tasks (kanban + DnD), decisions, roadmap, founder notes
- Inbox capture with convert-to-task/decision/note
- Finance ledger with metrics and weekly review money section
- Documents metadata + IP assets table
- Work sessions on Today
- Morning briefing and weekly review (rule-based)
- Dashboard metrics and Octane score
- Activity log
- Agents read-only roster (seed)
- Settings: founder profile, entities, ownership map
- Export/import JSON snapshots, reset/clear local data
- Command search across entities
- Empty states on all primary routes
- Error boundary for render failures
- Current-week seed transactions on reset (dynamic dates)

## Known TODOs

- [ ] Supabase schema, auth, and sync (Checkpoint 8+)
- [ ] Real file storage for documents
- [ ] Persist company profile fields in Settings
- [ ] AI advisor and executable agents
- [ ] Holdings module
- [ ] E2E test suite in CI
- [ ] Middleware → proxy migration (Next 16) when trivial

## Do not build yet

- Supabase or any external API integration in this repo phase
- Replacing Zustand/localStorage with a remote-first architecture
- Removing or renaming existing routes/features without explicit scope
- Production secrets in the repo

## Next checkpoints

| Checkpoint | Focus |
|------------|--------|
| **8** | Supabase project, migrations, auth |
| **9** | Sync layer + conflict handling |
| **10** | AI Advisor (read-only recommendations) |
| **11** | Agent execution logs |
| **12** | Holdings + deployment (Vercel) |

## 7C deliverables

- README and this status doc
- `next.config` workspace root for lockfile warning
- Empty states, keyboard help, data safety warning
- Mobile polish (sidebar, tables, kanban scroll)
- `createSeedData()` with current-week finance
- `npm run build` green before commit
