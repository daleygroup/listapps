import "server-only";
import postgres, { type Sql } from "postgres";
import { assertSafeDbTarget } from "./guard";

/**
 * The web app's direct database connection, for the service layer's
 * server-privileged steps (for example looking up an invitation by token).
 * Customer-initiated writes still go through `withUser` so Row Level
 * Security applies.
 *
 * Returns null until D-004 supplies a development database, so builds and
 * CI need no secrets. Refuses production exactly like the migration tools.
 */
let cached: Sql | null = null;

export function getServerSql(): Sql | null {
  if (!process.env.DATABASE_URL) return null;
  if (cached) return cached;
  assertSafeDbTarget(process.env);
  cached = postgres(process.env.DATABASE_URL, {
    max: 5,
    // Supabase's pooler (transaction mode) does not support prepared statements.
    prepare: false,
    onnotice: () => {},
  });
  return cached;
}
