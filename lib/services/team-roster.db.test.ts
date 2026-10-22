import path from "node:path";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateUp } from "@/lib/db/migrator";
import {
  startLocalPostgres,
  type LocalPostgres,
} from "@/lib/db/testing/local-postgres";
import { installAuthStub } from "@/lib/db/testing/rls";
import { createInvitation } from "./invitations";
import { listManagedRosters } from "./team-roster";

let pg: LocalPostgres;
let sql: Sql;
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BROKER = uid(1); // brokerage owner
const TEAM_ADMIN = uid(2);
const MEMBER = uid(3);
const OTHER_OWNER = uid(4); // owner of a second brokerage
const STAFF = uid(5);
let brokerage: string;
let team: string;

beforeAll(async () => {
  pg = await startLocalPostgres();
  sql = postgres(pg.url, { max: 4, onnotice: () => {} });
  await installAuthStub(sql);
  await migrateUp(sql, path.resolve(__dirname, "../../db/migrations"));
  for (const [id, email] of [
    [BROKER, "broker@example.test"],
    [TEAM_ADMIN, "admin@example.test"],
    [MEMBER, "member@example.test"],
    [OTHER_OWNER, "other@example.test"],
    [STAFF, "staff@example.test"],
  ]) {
    await sql`insert into auth.users (id, email) values (${id}, ${email})`;
  }
  await sql`update public.users set full_name = 'Alex Admin' where id = ${TEAM_ADMIN}`;
  await sql`insert into public.platform_staff (user_id, staff_role) values (${STAFF}, 'superadmin')`;
  const acct = async (
    type: string,
    name: string,
    slug: string,
    parent: string | null,
  ) =>
    (
      await sql<{ id: string }[]>`
        insert into public.accounts (account_type, name, slug, parent_account_id)
        values (${type}, ${name}, ${slug}, ${parent}) returning id`
    )[0]!.id;
  brokerage = await acct("brokerage", "First Brokerage", "first-brk", null);
  team = await acct("team", "First Team", "first-team", brokerage);
  const second = await acct(
    "brokerage",
    "Second Brokerage",
    "second-brk",
    null,
  );
  await sql`insert into public.account_memberships (account_id, user_id, role, status, joined_at) values
    (${brokerage}, ${BROKER}, 'owner', 'active', now()),
    (${team}, ${TEAM_ADMIN}, 'admin', 'active', now()),
    (${team}, ${MEMBER}, 'member', 'active', now()),
    (${second}, ${OTHER_OWNER}, 'owner', 'active', now())`;
  await createInvitation(sql, {
    accountId: team,
    email: "newagent@example.test",
    role: "member",
    actorUserId: TEAM_ADMIN,
  });
}, 120_000);

afterAll(async () => {
  await sql?.end();
  await pg?.stop();
});

describe("listManagedRosters", () => {
  it("a team admin sees their team with members and the open invitation, not the brokerage", async () => {
    const rosters = await listManagedRosters(sql, TEAM_ADMIN);
    expect(rosters.map((r) => r.name)).toEqual(["First Team"]);
    const people = rosters[0]!.people;
    expect(people.map((p) => [p.email, p.status])).toEqual([
      ["admin@example.test", "active"],
      ["member@example.test", "active"],
      ["newagent@example.test", "invited"],
    ]);
    expect(
      people.find((p) => p.status === "invited")?.inviteExpiresAt,
    ).toBeInstanceOf(Date);
    expect(
      people.find((p) => p.status === "active")?.inviteExpiresAt,
    ).toBeNull();
  });

  it("authority flows down: the brokerage owner sees the brokerage and the team", async () => {
    const rosters = await listManagedRosters(sql, BROKER);
    expect(rosters.map((r) => r.name)).toEqual([
      "First Brokerage",
      "First Team",
    ]);
  });

  it("a plain member manages nothing", async () => {
    expect(await listManagedRosters(sql, MEMBER)).toEqual([]);
  });

  it("another brokerage's owner sees only their own office", async () => {
    const rosters = await listManagedRosters(sql, OTHER_OWNER);
    expect(rosters.map((r) => r.name)).toEqual(["Second Brokerage"]);
    expect(rosters[0]!.people.map((p) => p.email)).toEqual([
      "other@example.test",
    ]);
  });

  it("platform staff get nothing here, even though they can read more", async () => {
    expect(await listManagedRosters(sql, STAFF)).toEqual([]);
  });

  it("never returns invitation token hashes", async () => {
    const rosters = await listManagedRosters(sql, TEAM_ADMIN);
    expect(JSON.stringify(rosters)).not.toMatch(/invite_token|[0-9a-f]{64}/);
  });
});
