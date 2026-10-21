import path from "node:path";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateUp } from "@/lib/db/migrator";
import {
  startLocalPostgres,
  type LocalPostgres,
} from "@/lib/db/testing/local-postgres";
import { asUser, installAuthStub } from "@/lib/db/testing/rls";
import {
  acceptDefaults,
  reassignTransfer,
  removeMembership,
} from "./offboarding";

let pg: LocalPostgres;
let sql: Sql;
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const LEAD = uid(1);
const AGENT = uid(2);
const COLLEAGUE = uid(3);
const ADMIN = uid(4);
let team = "";
let brokerage = "";
const memberships: Record<string, string> = {};

beforeAll(async () => {
  pg = await startLocalPostgres();
  sql = postgres(pg.url, { max: 4, onnotice: () => {} });
  await installAuthStub(sql);
  await migrateUp(sql, path.resolve(__dirname, "../../db/migrations"));
  for (const [id, email] of [
    [LEAD, "lead@example.test"],
    [AGENT, "agent@example.test"],
    [COLLEAGUE, "colleague@example.test"],
    [ADMIN, "admin@example.test"],
  ]) {
    await sql`insert into auth.users (id, email) values (${id}, ${email})`;
  }
  [{ id: brokerage }] =
    await sql`insert into public.accounts (account_type, name, slug)
    values ('brokerage', 'Brokerage', 'brk') returning id`;
  [{ id: team }] =
    await sql`insert into public.accounts (account_type, parent_account_id, name, slug)
    values ('team', ${brokerage}, 'Team', 'team') returning id`;
  for (const [key, user, role] of [
    ["lead", LEAD, "owner"],
    ["agent", AGENT, "member"],
    ["colleague", COLLEAGUE, "member"],
    ["admin", ADMIN, "admin"],
  ] as const) {
    const [m] =
      await sql`insert into public.account_memberships (account_id, user_id, role, status, joined_at)
      values (${team}, ${user}, ${role}, 'active', now()) returning id`;
    memberships[key] = m.id;
  }
  await sql`insert into public.agent_profiles (user_id, display_name) values (${AGENT}, 'Agent')`;
  await sql`insert into public.organization_agent_settings (account_id, user_id, team_title)
            values (${team}, ${AGENT}, 'Buyer Specialist')`;
}, 120_000);

afterAll(async () => {
  await sql?.end();
  pg?.stop();
});

describe("offboarding", () => {
  it("members cannot remove anyone", async () => {
    await expect(
      removeMembership(sql, {
        membershipId: memberships.colleague,
        actorUserId: AGENT,
      }),
    ).rejects.toThrow(/permission/);
  });

  it("an admin cannot remove the owner", async () => {
    await expect(
      removeMembership(sql, {
        membershipId: memberships.lead,
        actorUserId: ADMIN,
      }),
    ).rejects.toThrow(/above your own/);
  });

  it("removal revokes access immediately and builds a hand-off list to the team lead", async () => {
    const r = await removeMembership(sql, {
      membershipId: memberships.agent,
      actorUserId: ADMIN,
      reason: "Left the team",
    });
    expect(r.defaultToUserId).toBe(LEAD);
    expect(r.transferIds).toHaveLength(2);

    await asUser(sql, AGENT, async (tx) => {
      expect(
        await tx`select 1 from public.accounts where id = ${team}`,
      ).toHaveLength(0);
      // They can still see their own hand-off list, and their profile stays theirs.
      const items = await tx<{ item_type: string; status: string }[]>`
        select item_type, status from public.ownership_transfers order by item_type`;
      expect(items).toEqual([
        { item_type: "agent_profiles", status: "not_transferable" },
        { item_type: "organization_agent_settings", status: "pending" },
      ]);
    });

    const [m] =
      await sql`select status, removed_by_user_id from public.account_memberships
                          where id = ${memberships.agent}`;
    expect(m).toEqual({ status: "removed", removed_by_user_id: ADMIN });
  });

  it("the lead accepts the defaults and every transfer is logged; nothing was deleted", async () => {
    expect(
      await acceptDefaults(sql, {
        membershipId: memberships.agent,
        actorUserId: LEAD,
      }),
    ).toBe(1);
    const [t] =
      await sql`select status, to_user_id, actor_user_id, completed_at is not null as done
      from public.ownership_transfers where item_type = 'organization_agent_settings'`;
    expect(t).toEqual({
      status: "accepted",
      to_user_id: LEAD,
      actor_user_id: LEAD,
      done: true,
    });

    const [{ n }] = await sql`select count(*)::int as n from public.audit_logs
      where action in ('membership.changed', 'ownership_transfer.changed', 'ownership_transfer.created')`;
    expect(n).toBeGreaterThanOrEqual(3);
    const [{ settings }] =
      await sql`select count(*)::int as settings from public.organization_agent_settings`;
    expect(settings).toBe(1);
  });

  it("completed transfers cannot be changed", async () => {
    const [t] = await sql<
      { id: string }[]
    >`select id from public.ownership_transfers
      where item_type = 'organization_agent_settings'`;
    await expect(
      reassignTransfer(sql, {
        transferId: t.id,
        toUserId: COLLEAGUE,
        actorUserId: LEAD,
      }),
    ).rejects.toThrow(/already completed/);
  });

  it("a removal with nothing to hand off works, and removing twice is refused", async () => {
    const r = await removeMembership(sql, {
      membershipId: memberships.colleague,
      actorUserId: LEAD,
    });
    expect(r.transferIds).toHaveLength(0); // nothing controlled yet in Milestone 1
    await expect(
      removeMembership(sql, {
        membershipId: memberships.colleague,
        actorUserId: LEAD,
      }),
    ).rejects.toThrow(/already removed/);
  });
});
