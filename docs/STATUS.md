# ListApps build status

Every run reads this first and updates it last. Keep it short and current.

**Current milestone:** 1, "Who You Are" (Milestone 0 foundation done 2026-10-21)
**Real-build target:** eight-step demo loop on real data, about mid-December 2026 (see CLAUDE.md 0a)
**Last updated:** 2026-10-21 by background build run

---

## Backlog (work top to bottom; skip anything blocked)

### Milestone 0: Repository foundation (no approval needed, stack approved in docs/02)
- [x] M0-1 Scaffold Next.js 16 (App Router) + TypeScript strict + Tailwind, `pnpm` as package manager, route groups `app/(platform)/` and `app/(apps)/openly/`, `app/(apps)/listvault/`, `app/(apps)/curb/` placeholders. Home page says "ListApps".
- [x] M0-2 Tooling: ESLint, Prettier, Vitest, `pnpm typecheck`, `pnpm test`, `pnpm build`. GitHub Actions workflow running lint, typecheck, test, build on every push.
- [x] M0-3 Drizzle ORM configured with SQL migrations in `db/migrations/` (numbered, reversible, with a matching `down` file). No tables yet.
- [x] M0-4 Local disposable test database for RLS tests: a real Postgres started inside the run (system package or `embedded-postgres`), plus a minimal `auth` schema stub (`auth.uid()` reading a session setting) so Supabase-style RLS policies can be tested without Supabase. Document the command in `docs/TESTING.md`.
- [x] M0-5 Design tokens: CSS variables for color, font, radius, spacing in one file, consumed by Tailwind. No hardcoded colors in components.

### Milestone 1: Who You Are
- [x] M1-1 *(done, D-003 now waiting on Joseph)* Write proposal `docs/proposals/001-milestone-1-schema.md`: all 17 tables from CLAUDE.md section 12, every column, the shared-vs-app test result for each, every RLS policy in plain English, indexes. Add D-003 as PENDING. **Do not write migrations until D-003 is APPROVED.**
- [x] M1-2 Pure TypeScript resolvers with unit tests, no database needed: (a) tree-walk resolver used for theme, brand kit, and settings inheritance; (b) permission resolver (membership on an ancestor grants authority below it; capabilities from role_permissions rows); (c) entitlement resolver (own individual subscription OR ancestor subscription with includes_descendants and free seats). Test every case in CLAUDE.md section 4.
- [x] M1-3 App shell UI with the app switcher (mobile-first), driven by the entitlement resolver against in-memory fixture data. No database calls yet.
- [ ] M1-4 *(blocked by D-003)* Migrations for the 17 tables with RLS, plus automated RLS tests against the local test database proving: a second brokerage's rows are invisible; authority flows down the tree, never up or sideways; `sales` staff cannot read contacts or listing content.
- [ ] M1-5 *(blocked by D-004)* Supabase Auth wiring: email and password, password reset, session handling, "Sign in with Google" (basic scope).
- [ ] M1-6 *(blocked by D-003, D-005)* Invitations by email, accept flow.
- [ ] M1-7 *(blocked by D-003)* Impersonation for platform staff: banner, `impersonation_sessions` log, notification email queued.
- [ ] M1-8 *(blocked by D-003)* Offboarding workflow: membership removal, inventory, default transfer to next authority up, `ownership_transfers` rows, no deletes.
- [ ] M1-9 *(blocked by D-003: seeds the approved tables)* Seed script for one brokerage (KW Metro South) with one team (The Daley Group), plus a second test brokerage named "Test Brokerage Two" (docs/M1-VERIFY.md uses that name). Names live only in the seed file.
- [x] M1-10 Write `docs/M1-VERIFY.md`: the hand checklist from CLAUDE.md section 12 rewritten as plain steps Joseph can click through.

### Next (do not start until Milestone 1 is verified)
- Milestone 2 proposal: lightweight listings (`properties`, `listings`, `listing_assignments`, `listing_status_history`, basic `listing_media`).
- Milestone 3: Openly core with atomic claims.
- Milestones 4 and 5: the ListVault slice and open house sign-in (see docs/08).

---

## Waiting on Joseph
- **D-003 Milestone 1 schema approval: the one decision blocking all remaining Milestone 1 work.** Read Part 1 of docs/proposals/001-milestone-1-schema.md.
- D-004 Supabase `listapps-development` project credentials for hosted runs
- D-005 Email sending service for invitations (Resend recommended)
- D-006 OHDibs non-renewal notice date
- D-007 Default data policies when agents or teams leave (not blocking yet)

---

## Notes
- Stack is fixed by docs/02: Next.js 16, TypeScript, Supabase (Postgres, Auth, Storage), Drizzle, Vercel, Satori + resvg-js, pdf-lib. Rendering workers on a container host later (docs/04).
- Migrations are hand-written numbered up/down SQL pairs run by `lib/db/migrator.ts` (`pnpm db:migrate`), not drizzle-kit generated, so RLS and reversibility stay readable. Drizzle ORM is still the query layer. Bookkeeping lives in the `listapps_meta` schema so Supabase's API never exposes it.
- DB tests (`pnpm test:db`) spin up a throwaway local Postgres per file; when run as root they drop to the `postgres` user. CI runs them on GitHub's runner. See docs/TESTING.md.
- `next.config.ts` has `cacheComponents` on (Next 16 default template). Anything reading the clock or the session must be dynamic; the fixture shell uses a fixed clock for now.
- Open technical items for the M1-4 build: how seat holders are recorded (the resolver accepts a `holdsSeat` callback; proposal 001 only has a `seats_used` counter), and whether `past_due` keeps access during a grace period (a business call, only matters once billing exists).
- App placeholder pages are reachable by URL whether or not the user is entitled; route guarding arrives with authentication (M1-5).
- The clickable demo prototype for October 30 is built and published outside this repo. Do not build prototype screens here.

---

## Run log (newest first)
- 2026-10-21 Build run 1: finished Milestone 0 (Next.js 16 scaffold, lint/format/typecheck/test/build, CI green on GitHub, reversible migration runner, local Postgres RLS harness, design tokens). M1-1 schema proposal written (D-003 PENDING), D-007 added. M1-2 resolvers and M1-3 app shell with switcher done, M1-10 verify checklist written. Next: everything left in Milestone 1 waits on D-003 (plus D-004, D-005 for auth and email). WAITING email sent to Joseph for D-003. Nothing broken.
- 2026-10-21 Setup session: repo initialized, CLAUDE.md updated with unattended-run rules (section 0b) and the revised deadline, planning docs 01 through 09 added, backlog written. Next: M0-1.
