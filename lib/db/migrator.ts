import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Sql } from "postgres";

/**
 * Hand-written, numbered, reversible SQL migrations.
 *
 * Every migration is a pair of files in db/migrations/:
 *   0001_short_name.up.sql
 *   0001_short_name.down.sql
 *
 * Why not drizzle-kit's generator: RLS policies, path-prefix indexes, and
 * reversibility all need hand-written SQL that a reviewer can read. Drizzle ORM
 * is still used for typed queries in lib/services/.
 *
 * Bookkeeping lives in its own schema (listapps_meta), never in public, so
 * Supabase's auto-generated API never exposes it.
 */

export interface Migration {
  version: string;
  name: string;
  upPath: string;
  downPath: string;
}

const FILE_RE = /^(\d{4})_([a-z0-9_]+)\.(up|down)\.sql$/;
export const META_SCHEMA = "listapps_meta";

export function loadMigrations(dir: string): Migration[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  const byVersion = new Map<
    string,
    { name: string; up?: string; down?: string }
  >();

  for (const file of files) {
    const m = FILE_RE.exec(file);
    if (!m) {
      throw new Error(
        `Migration file "${file}" does not match NNNN_name.up.sql or NNNN_name.down.sql`,
      );
    }
    const [, version, name, direction] = m;
    const entry = byVersion.get(version) ?? { name };
    if (entry.name !== name) {
      throw new Error(
        `Migration ${version} has mismatched names: "${entry.name}" and "${name}"`,
      );
    }
    entry[direction as "up" | "down"] = path.join(dir, file);
    byVersion.set(version, entry);
  }

  const versions = [...byVersion.keys()].sort();
  versions.forEach((v, i) => {
    const expected = String(i + 1).padStart(4, "0");
    if (v !== expected) {
      throw new Error(
        `Migration numbering has a gap or duplicate: expected ${expected}, found ${v}`,
      );
    }
  });

  return versions.map((version) => {
    const e = byVersion.get(version)!;
    if (!e.up || !e.down) {
      throw new Error(
        `Migration ${version}_${e.name} needs both an .up.sql and a .down.sql file`,
      );
    }
    return { version, name: e.name, upPath: e.up, downPath: e.down };
  });
}

async function ensureMeta(sql: Sql): Promise<void> {
  await sql.unsafe(`
    create schema if not exists ${META_SCHEMA};
    revoke all on schema ${META_SCHEMA} from public;
    create table if not exists ${META_SCHEMA}.schema_migrations (
      version text primary key,
      name text not null,
      applied_at timestamptz not null default now()
    );
  `);
}

export async function appliedVersions(sql: Sql): Promise<string[]> {
  await ensureMeta(sql);
  const rows = await sql.unsafe<{ version: string }[]>(
    `select version from ${META_SCHEMA}.schema_migrations order by version`,
  );
  return rows.map((r) => r.version);
}

/** Applies every pending migration, each in its own transaction. Returns versions applied. */
export async function migrateUp(sql: Sql, dir: string): Promise<string[]> {
  const migrations = loadMigrations(dir);
  await ensureMeta(sql);
  const applied: string[] = [];
  for (const mig of migrations) {
    const did = await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('listapps_migrations'))`;
      const existing = await tx.unsafe(
        `select 1 from ${META_SCHEMA}.schema_migrations where version = $1`,
        [mig.version],
      );
      if (existing.length > 0) return false;
      await tx.unsafe(readFileSync(mig.upPath, "utf8"));
      await tx.unsafe(
        `insert into ${META_SCHEMA}.schema_migrations (version, name) values ($1, $2)`,
        [mig.version, mig.name],
      );
      return true;
    });
    if (did) applied.push(mig.version);
  }
  return applied;
}

/** Reverts the most recent `steps` applied migrations, newest first. Returns versions reverted. */
export async function migrateDown(
  sql: Sql,
  dir: string,
  steps = 1,
): Promise<string[]> {
  const migrations = new Map(loadMigrations(dir).map((m) => [m.version, m]));
  const done = (await appliedVersions(sql)).reverse().slice(0, steps);
  const reverted: string[] = [];
  for (const version of done) {
    const mig = migrations.get(version);
    if (!mig) {
      throw new Error(
        `Applied migration ${version} has no files in ${dir}; refusing to guess how to revert it`,
      );
    }
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('listapps_migrations'))`;
      await tx.unsafe(readFileSync(mig.downPath, "utf8"));
      await tx.unsafe(
        `delete from ${META_SCHEMA}.schema_migrations where version = $1`,
        [version],
      );
    });
    reverted.push(version);
  }
  return reverted;
}
