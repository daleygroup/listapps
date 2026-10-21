import path from "node:path";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateUp } from "@/lib/db/migrator";
import {
  startLocalPostgres,
  type LocalPostgres,
} from "@/lib/db/testing/local-postgres";
import { asUser, installAuthStub } from "@/lib/db/testing/rls";
import { seedMilestone1 } from "./milestone1";

let pg: LocalPostgres;
let sql: Sql;
const OWNER = "00000000-0000-4000-8000-0000000000aa";

beforeAll(async () => {
  pg = await startLocalPostgres();
  sql = postgres(pg.url, { max: 2, onnotice: () => {} });
  await installAuthStub(sql);
  await migrateUp(sql, path.resolve(__dirname, "../migrations"));
  await sql`insert into auth.users (id, email) values (${OWNER}, 'owner@example.test')`;
}, 120_000);

afterAll(async () => {
  await sql?.end();
  pg?.stop();
});

describe("Milestone 1 seed", () => {
  it("creates the brokerage, the team beneath it, and an unrelated test brokerage", async () => {
    const r = await seedMilestone1(sql, { ownerEmail: "owner@example.test" });
    const [team] =
      await sql`select parent_account_id from public.accounts where id = ${r.teamAccountId}`;
    expect(team.parent_account_id).toBe(r.brokerageAccountId);
    const [test] =
      await sql`select parent_account_id from public.accounts where id = ${r.testBrokerageAccountId}`;
    expect(test.parent_account_id).toBeNull();
  });

  it("is idempotent", async () => {
    const a = await seedMilestone1(sql, { ownerEmail: "owner@example.test" });
    const b = await seedMilestone1(sql, { ownerEmail: "owner@example.test" });
    expect(b).toEqual(a);
    const [{ n }] =
      await sql`select count(*)::int as n from public.account_memberships where user_id = ${OWNER}`;
    expect(n).toBe(2); // personal account + team owner
  });

  it("makes the owner team owner, who cannot see the test brokerage as a customer", async () => {
    const r = await seedMilestone1(sql);
    // Drop staff for this check by reading as a customer-only view: memberships.
    await asUser(sql, OWNER, async (tx) => {
      const ms = await tx<{ account_id: string; role: string }[]>`
        select account_id, role from public.account_memberships where user_id = ${OWNER}`;
      expect(ms).toContainEqual({ account_id: r.teamAccountId, role: "owner" });
      expect(ms.map((m) => m.account_id)).not.toContain(
        r.testBrokerageAccountId,
      );
    });
  });

  it("refuses an owner email that has no login", async () => {
    await expect(
      seedMilestone1(sql, { ownerEmail: "nobody@example.test" }),
    ).rejects.toThrow(/No login exists/);
  });
});
