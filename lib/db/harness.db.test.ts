import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appliedVersions, migrateDown, migrateUp } from "./migrator";
import {
  startLocalPostgres,
  type LocalPostgres,
} from "./testing/local-postgres";
import { asUser, installAuthStub } from "./testing/rls";

// These fixtures exist only to prove the harness works. They are not app schema.
const FIXTURE_UP = `
create table public.harness_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  body text not null
);
alter table public.harness_notes enable row level security;
create policy harness_notes_own on public.harness_notes
  for select to authenticated using (owner_id = auth.uid());
grant select on public.harness_notes to authenticated;
`;
const FIXTURE_DOWN = `drop table public.harness_notes;`;

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";

let pg: LocalPostgres;
let sql: Sql;
let dir: string;

beforeAll(async () => {
  pg = await startLocalPostgres();
  sql = postgres(pg.url, { max: 2, onnotice: () => {} });
  await installAuthStub(sql);
  dir = mkdtempSync(path.join(os.tmpdir(), "mig-fixture-"));
  writeFileSync(path.join(dir, "0001_harness_notes.up.sql"), FIXTURE_UP);
  writeFileSync(path.join(dir, "0001_harness_notes.down.sql"), FIXTURE_DOWN);
});

afterAll(async () => {
  await sql?.end();
  pg?.stop();
});

describe("migration runner against a real local Postgres", () => {
  it("applies, is idempotent, and reverts", async () => {
    expect(await migrateUp(sql, dir)).toEqual(["0001"]);
    expect(await migrateUp(sql, dir)).toEqual([]);
    expect(await appliedVersions(sql)).toEqual(["0001"]);

    expect(await migrateDown(sql, dir, 1)).toEqual(["0001"]);
    const [{ exists }] =
      await sql`select to_regclass('public.harness_notes') is not null as exists`;
    expect(exists).toBe(false);

    await migrateUp(sql, dir);
  });
});

describe("RLS harness", () => {
  it("auth.uid() scopes rows to the signed-in user", async () => {
    await sql`insert into public.harness_notes (owner_id, body) values (${ALICE}, 'alice note'), (${BOB}, 'bob note')`;

    const aliceSees = await asUser(
      sql,
      ALICE,
      (tx) => tx<{ body: string }[]>`select body from public.harness_notes`,
    );
    expect(aliceSees.map((r) => r.body)).toEqual(["alice note"]);

    const bobSees = await asUser(
      sql,
      BOB,
      (tx) => tx<{ body: string }[]>`select body from public.harness_notes`,
    );
    expect(bobSees.map((r) => r.body)).toEqual(["bob note"]);
  });

  it("anonymous sessions see nothing", async () => {
    const rows = await sql.begin(async (tx) => {
      await tx.unsafe("set local role authenticated");
      return tx`select * from public.harness_notes`;
    });
    expect(rows).toHaveLength(0);
  });
});
