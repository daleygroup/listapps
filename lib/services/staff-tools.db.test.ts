import path from "node:path";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateUp } from "@/lib/db/migrator";
import {
  startLocalPostgres,
  type LocalPostgres,
} from "@/lib/db/testing/local-postgres";
import { installAuthStub } from "@/lib/db/testing/rls";
import { endImpersonation } from "./impersonation";
import { getStaffMember, startImpersonationByEmail } from "./staff-tools";

let pg: LocalPostgres;
let sql: Sql;
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SUPPORT = uid(1);
const SALES = uid(2);
const RETIRED = uid(3); // staff record no longer active
const OWNER = uid(4); // brokerage owner, a customer
const AGENT = uid(5);

beforeAll(async () => {
  pg = await startLocalPostgres();
  sql = postgres(pg.url, { max: 4, onnotice: () => {} });
  await installAuthStub(sql);
  await migrateUp(sql, path.resolve(__dirname, "../../db/migrations"));
  for (const [id, email] of [
    [SUPPORT, "support@example.test"],
    [SALES, "sales@example.test"],
    [RETIRED, "retired@example.test"],
    [OWNER, "owner@example.test"],
    [AGENT, "agent@example.test"],
  ]) {
    await sql`insert into auth.users (id, email) values (${id}, ${email})`;
  }
  await sql`insert into public.platform_staff (user_id, staff_role, can_elevate_impersonation, active) values
    (${SUPPORT}, 'support', true, true), (${SALES}, 'sales', false, true),
    (${RETIRED}, 'support', false, false)`;
  const [{ id: brokerage }] =
    await sql`insert into public.accounts (account_type, name, slug)
    values ('brokerage', 'Brokerage', 'brk') returning id`;
  await sql`insert into public.account_memberships (account_id, user_id, role, status, joined_at) values
    (${brokerage}, ${OWNER}, 'owner', 'active', now()),
    (${brokerage}, ${AGENT}, 'member', 'active', now())`;
}, 120_000);

afterAll(async () => {
  await sql?.end();
  await pg?.stop();
});

describe("staff tools", () => {
  it("only active staff are staff", async () => {
    expect(await getStaffMember(sql, SUPPORT)).toEqual({
      staffRole: "support",
      canElevate: true,
    });
    expect(await getStaffMember(sql, OWNER)).toBeNull();
    expect(await getStaffMember(sql, RETIRED)).toBeNull();
  });

  it("a customer, even a brokerage owner, cannot start a session or probe emails", async () => {
    await expect(
      startImpersonationByEmail(sql, {
        staffUserId: OWNER,
        email: "agent@example.test",
        reason: "checking",
      }),
    ).rejects.toThrow(/Only ListApps staff/);
    await expect(
      startImpersonationByEmail(sql, {
        staffUserId: OWNER,
        email: "nobody@example.test",
        reason: "checking",
      }),
    ).rejects.toThrow(/Only ListApps staff/);
  });

  it("refuses a malformed or unknown email, and staff targets", async () => {
    await expect(
      startImpersonationByEmail(sql, {
        staffUserId: SUPPORT,
        email: "agent",
        reason: "x",
      }),
    ).rejects.toThrow(/full email/);
    await expect(
      startImpersonationByEmail(sql, {
        staffUserId: SUPPORT,
        email: "nobody@example.test",
        reason: "x",
      }),
    ).rejects.toThrow(/Nobody with that email/);
    await expect(
      startImpersonationByEmail(sql, {
        staffUserId: SUPPORT,
        email: "sales@example.test",
        reason: "x",
      }),
    ).rejects.toThrow(/Staff accounts cannot be impersonated/);
  });

  it("starts a logged read-only session by email, case-insensitively", async () => {
    const s = await startImpersonationByEmail(sql, {
      staffUserId: SALES,
      email: "  Agent@Example.TEST ",
      reason: "Demo question from the office",
      minutes: 30,
    });
    expect(s.targetUserId).toBe(AGENT);
    expect(s.mode).toBe("read_only");
    const [log] = await sql`select action, reason from public.audit_logs
      where impersonation_session_id = ${s.id}`;
    expect(log).toEqual({
      action: "impersonation.started",
      reason: "Demo question from the office",
    });
    await endImpersonation(sql, { sessionId: s.id, staffUserId: SALES });
  });
});
