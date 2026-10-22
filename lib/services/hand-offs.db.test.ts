import path from "node:path";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateUp } from "@/lib/db/migrator";
import {
  startLocalPostgres,
  type LocalPostgres,
} from "@/lib/db/testing/local-postgres";
import { installAuthStub } from "@/lib/db/testing/rls";
import { listHandOffs } from "./hand-offs";
import {
  acceptDefaults,
  reassignTransfer,
  removeMembership,
} from "./offboarding";

let pg: LocalPostgres;
let sql: Sql;
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BROKER = uid(1); // brokerage owner
const LEAD = uid(2); // team owner
const ADMIN = uid(3); // team admin
const AGENT = uid(4); // departing member
const COLLEAGUE = uid(5);
const OTHER_OWNER = uid(6); // second brokerage
const LONER = uid(7); // member of a team with no owner
let brokerage = "";
let team = "";
let ownerlessTeam = "";
const ms: Record<string, string> = {};

beforeAll(async () => {
  pg = await startLocalPostgres();
  sql = postgres(pg.url, { max: 4, onnotice: () => {} });
  await installAuthStub(sql);
  await migrateUp(sql, path.resolve(__dirname, "../../db/migrations"));
  const people: [string, string, string][] = [
    [BROKER, "broker@example.test", "Bea Broker"],
    [LEAD, "lead@example.test", "Lee Lead"],
    [ADMIN, "admin@example.test", "Ada Admin"],
    [AGENT, "agent@example.test", "Avery Agent"],
    [COLLEAGUE, "colleague@example.test", "Cole Colleague"],
    [OTHER_OWNER, "other@example.test", "Otto Other"],
    [LONER, "loner@example.test", "Lou Loner"],
  ];
  for (const [id, email, name] of people) {
    await sql`insert into auth.users (id, email) values (${id}, ${email})`;
    await sql`update public.users set full_name = ${name} where id = ${id}`;
  }
  const acct = async (type: string, slug: string, parent: string | null) =>
    (
      await sql<{ id: string }[]>`
        insert into public.accounts (account_type, name, slug, parent_account_id)
        values (${type}, ${slug}, ${slug.toLowerCase().replaceAll(" ", "-")}, ${parent}) returning id`
    )[0]!.id;
  brokerage = await acct("brokerage", "First Brokerage", null);
  team = await acct("team", "First Team", brokerage);
  ownerlessTeam = await acct("team", "Ownerless Team", brokerage);
  const second = await acct("brokerage", "Second Brokerage", null);
  const join = async (
    key: string,
    account: string,
    user: string,
    role: string,
  ) => {
    const [m] = await sql<{ id: string }[]>`
      insert into public.account_memberships (account_id, user_id, role, status, joined_at)
      values (${account}, ${user}, ${role}, 'active', now()) returning id`;
    ms[key] = m!.id;
  };
  await join("broker", brokerage, BROKER, "owner");
  await join("lead", team, LEAD, "owner");
  await join("admin", team, ADMIN, "admin");
  await join("agent", team, AGENT, "member");
  await join("colleague", team, COLLEAGUE, "member");
  await join("other", second, OTHER_OWNER, "owner");
  await join("loner", ownerlessTeam, LONER, "member");
  for (const [user, account] of [
    [AGENT, team],
    [LONER, ownerlessTeam],
  ] as const) {
    await sql`insert into public.agent_profiles (user_id, display_name) values (${user}, 'x')`;
    await sql`insert into public.organization_agent_settings (account_id, user_id, team_title)
              values (${account}, ${user}, 'Agent')`;
  }
  await removeMembership(sql, {
    membershipId: ms.agent!,
    actorUserId: ADMIN,
    reason: "Moved away",
  });
}, 120_000);

afterAll(async () => {
  await sql?.end();
  await pg?.stop();
});

describe("listHandOffs", () => {
  it("the team lead sees the departed person's name and both items, defaulting to them", async () => {
    const [h, ...rest] = await listHandOffs(sql, LEAD);
    expect(rest).toEqual([]);
    expect(h!.departed).toEqual({
      userId: AGENT,
      name: "Avery Agent",
      email: "agent@example.test",
    });
    expect(h!.accountName).toBe("First Team");
    expect(h!.removedAt).toBeInstanceOf(Date);
    expect(
      h!.items.map((i) => [i.itemType, i.status, i.defaultTo?.name ?? null]),
    ).toEqual([
      ["agent_profiles", "not_transferable", null],
      ["organization_agent_settings", "pending", "Lee Lead"],
    ]);
  });

  it("offers only active people in that team, never the departed person", async () => {
    const [h] = await listHandOffs(sql, LEAD);
    expect(h!.candidates.map((c) => c.name).sort()).toEqual([
      "Ada Admin",
      "Cole Colleague",
      "Lee Lead",
    ]);
  });

  it("authority flows down: the brokerage owner and the team admin see it too", async () => {
    expect((await listHandOffs(sql, BROKER)).length).toBeGreaterThan(0);
    expect(await listHandOffs(sql, ADMIN)).toHaveLength(1);
  });

  it("plain members, the departed person, and another brokerage see nothing to act on", async () => {
    expect(await listHandOffs(sql, COLLEAGUE)).toEqual([]);
    expect(await listHandOffs(sql, AGENT)).toEqual([]);
    expect(await listHandOffs(sql, OTHER_OWNER)).toEqual([]);
  });

  it("a team with no owner defaults to the brokerage owner", async () => {
    const r = await removeMembership(sql, {
      membershipId: ms.loner!,
      actorUserId: BROKER,
    });
    expect(r.defaultToUserId).toBe(BROKER);
    const handOffs = await listHandOffs(sql, BROKER);
    const loner = handOffs.find((h) => h.departed.userId === LONER);
    expect(loner?.items.find((i) => i.status === "pending")?.defaultTo).toEqual(
      { userId: BROKER, name: "Bea Broker" },
    );
  });

  it("once every item is decided the hand-off leaves the list", async () => {
    const [h] = await listHandOffs(sql, LEAD);
    const pending = h!.items.find((i) => i.status === "pending")!;
    await reassignTransfer(sql, {
      transferId: pending.transferId,
      toUserId: COLLEAGUE,
      actorUserId: LEAD,
    });
    expect(await listHandOffs(sql, LEAD)).toEqual([]);
    // Nothing left to accept, and history kept the decision.
    expect(
      await acceptDefaults(sql, {
        membershipId: ms.agent!,
        actorUserId: LEAD,
      }),
    ).toBe(0);
    const [t] =
      await sql`select status, to_user_id from public.ownership_transfers
      where id = ${pending.transferId}`;
    expect(t).toEqual({ status: "reassigned", to_user_id: COLLEAGUE });
  });
});

describe("removing a member", () => {
  it("nobody can remove themselves", async () => {
    await expect(
      removeMembership(sql, { membershipId: ms.admin!, actorUserId: ADMIN }),
    ).rejects.toThrow(/cannot remove yourself/);
  });
});
