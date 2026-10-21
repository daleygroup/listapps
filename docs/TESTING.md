# Testing

All tests run locally against disposable data. Nothing here ever connects to a hosted database.

## Commands

- `pnpm test`: unit tests (no database). Fast. Runs on every commit.
- `pnpm test:db`: database tests (`*.db.test.ts`). Each test file starts its own throwaway Postgres cluster in a temp directory, on a random port, and deletes it afterwards.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build`: the rest of the gate. CI runs all of them on every push.

## Requirements for `pnpm test:db`

- Postgres server binaries (Ubuntu: `apt-get install postgresql`; GitHub's ubuntu runners already have them). Discovery order: `PG_BIN` env var, newest `/usr/lib/postgresql/<version>/bin`, then `pg_config --bindir`.
- If run as root (as in cloud build sessions), the helper drops to the `postgres` user for `initdb` and `pg_ctl`, because Postgres refuses to run as root.

## Testing RLS without Supabase

- `db/testing/auth-stub.sql` recreates the small part of Supabase that RLS policies depend on: `auth.uid()`, `auth.role()`, `auth.jwt()`, a minimal `auth.users`, and the `anon`, `authenticated`, and `service_role` roles. **Test databases only.** Never apply it to a Supabase project.
- `installAuthStub(sql)` installs it. `asUser(sql, userId, fn)` runs `fn` as that signed-in user (role `authenticated`, JWT subject set) inside a transaction that is always rolled back.
- `lib/db/harness.db.test.ts` is the worked example: one user cannot see another user's rows.

## Migrations

See `db/migrations/README.md`. `pnpm db:migrate up | down [steps] | status` requires `DATABASE_URL` and `LISTAPPS_DB_TARGET=local` or `development`. Anything that looks like production is refused.
