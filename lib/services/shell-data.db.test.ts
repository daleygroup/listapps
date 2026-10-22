import path from "node:path";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateUp } from "@/lib/db/migrator";
import {
  startLocalPostgres,
  type LocalPostgres,
} from "@/lib/db/testing/local-postgres";
import { installAuthStub } from "@/lib/db/testing/rls";
import { getShellView } from "./app-shell";
import { endImpersonation, startImpersonation } from "./impersonation";
import { loadShellDataSource, ViewAsRefusedError } from "./shell-data";

let pg: LocalPostgres;
let sql: Sql;
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const TEAM_ADMIN = uid(1);
const TEAM_MEMBER = uid(2); // also owns an individual account with Curb
const OTHER_AGENT = uid(3); // in a second brokerage only
const STAFF = uid(4); // platform staff, no customer memberships
const NOBODY = uid(5); // signed in, no memberships yet
const LAPSED_AGENT = uid(6); // second brokerage, lapsed subscription only

const appId = async (slug: string) =>
  (
    await sql<
      { id: string }[]
    >`select id from public.applications where slug = ${slug}`
  )[0]!.id;

beforeAll(async () => {
  pg = await startLocalPostgres();
  sql = postgres(pg.url, { max: 4, onnotice: () => {} });
  await installAuthStub(sql);
  await migrateUp(sql, path.resolve(__dirname, "../../db/migrations"));
  for (const [id, email] of [
    [TEAM_ADMIN, "admin@example.test"],
    [TEAM_MEMBER, "member@example.test"],
    [OTHER_AGENT, "other@example.test"],
    [STAFF, "staff@example.test"],
    [NOBODY, "nobody@example.test"],
    [LAPSED_AGENT, "lapsed@example.test"],
  ]) {
    await sql`insert into auth.users (id, email) values (${id}, ${email})`;
  }
  await sql`update public.users set full_name = 'Morgan Member' where id = ${TEAM_MEMBER}`;
  await sql`insert into public.platform_staff (user_id, staff_role) values (${STAFF}, 'support')`;

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
  const brokerage = await acct(
    "brokerage",
    "First Brokerage",
    "first-brk",
    null,
  );
  const team = await acct("team", "First Team", "first-team", brokerage);
  const individual = await acct("individual", "Morgan Member", "morgan", null);
  const second = await acct(
    "brokerage",
    "Second Brokerage",
    "second-brk",
    null,
  );

  await sql`insert into public.account_memberships (account_id, user_id, role, status, joined_at) values
    (${team}, ${TEAM_ADMIN}, 'admin', 'active', now()),
    (${team}, ${TEAM_MEMBER}, 'member', 'active', now()),
    (${individual}, ${TEAM_MEMBER}, 'owner', 'active', now()),
    (${second}, ${OTHER_AGENT}, 'member', 'active', now()),
    (${second}, ${LAPSED_AGENT}, 'member', 'active', now())`;

  const [listvault, curb, openly] = [
    await appId("listvault"),
    await appId("curb"),
    await appId("openly"),
  ];
  await sql`insert into public.subscriptions
    (account_id, application_id, status, includes_descendants) values
    (${brokerage}, ${listvault}, 'active', true),
    (${individual}, ${curb}, 'active', false),
    (${second}, ${openly}, 'lapsed', true)`;
}, 120_000);

afterAll(async () => {
  await sql?.end();
  await pg?.stop();
});

const NOW = new Date("2026-10-22T12:00:00Z");
async function viewFor(userId: string) {
  const source = await loadShellDataSource(sql, userId);
  if (!source) return null;
  return getShellView(source, userId, NOW);
}

describe("loadShellDataSource (real-data app switcher)", () => {
  it("a brokerage subscription with includes_descendants reaches the team admin", async () => {
    const view = await viewFor(TEAM_ADMIN);
    expect(view?.apps.map((a) => a.slug)).toEqual(["listvault"]);
    expect(view?.accountName).toBe("First Team");
  });

  it("the team member gets the brokerage app plus their own Curb", async () => {
    const view = await viewFor(TEAM_MEMBER);
    expect(view?.apps.map((a) => a.slug)).toEqual(["listvault", "curb"]);
    expect(view?.userName).toBe("Morgan Member");
  });

  it("a second brokerage's agent sees none of the first brokerage's data", async () => {
    const source = await loadShellDataSource(sql, OTHER_AGENT);
    const names = source?.accounts.map((a) => a.name) ?? [];
    expect(names).toContain("Second Brokerage");
    expect(names).not.toContain("First Brokerage");
    expect(names).not.toContain("First Team");
    expect(source?.subscriptions.every((s) => s.status === "lapsed")).toBe(
      true,
    );
  });

  it("a lapsed subscription does not open the app", async () => {
    const view = await viewFor(LAPSED_AGENT);
    expect(view?.apps).toEqual([]);
  });

  it("platform staff see only their own (empty) switcher, not every customer's", async () => {
    const source = await loadShellDataSource(sql, STAFF);
    // Only the personal account every sign-in gets, no customer accounts.
    expect(source?.accounts.map((a) => a.type)).toEqual(["individual"]);
    expect(source?.subscriptions).toEqual([]);
    expect(getShellView(source!, STAFF, NOW).apps).toEqual([]);
  });

  it("someone signed in with no memberships gets an empty shell, falling back to their email", async () => {
    const view = await viewFor(NOBODY);
    expect(view).toEqual({
      userName: "nobody@example.test",
      accountName: null,
      apps: [],
    });
  });

  it("returns null for an id with no users row", async () => {
    expect(await loadShellDataSource(sql, uid(99))).toBeNull();
  });
});

describe("loadShellDataSource view-as (staff impersonation)", () => {
  it("is refused for staff with no live session on that person", async () => {
    await expect(
      loadShellDataSource(sql, STAFF, { viewAsUserId: TEAM_MEMBER }),
    ).rejects.toBeInstanceOf(ViewAsRefusedError);
  });

  it("is refused for a customer, even one with authority over the person", async () => {
    await expect(
      loadShellDataSource(sql, TEAM_ADMIN, { viewAsUserId: TEAM_MEMBER }),
    ).rejects.toBeInstanceOf(ViewAsRefusedError);
  });

  it("shows exactly the impersonated person's shell during a live session, and stops when it ends", async () => {
    const session = await startImpersonation(sql, {
      staffUserId: STAFF,
      targetUserId: TEAM_MEMBER,
      reason: "Checking app access for a support ticket",
    });
    const source = await loadShellDataSource(sql, STAFF, {
      viewAsUserId: TEAM_MEMBER,
    });
    const view = getShellView(source!, TEAM_MEMBER, NOW);
    expect(view.userName).toBe("Morgan Member");
    expect(view.accountName).toBe("First Team");
    expect(view.apps.map((a) => a.slug)).toEqual(["listvault", "curb"]);
    // Nothing from the second brokerage leaks into the view.
    expect(source!.accounts.map((a) => a.name)).not.toContain(
      "Second Brokerage",
    );

    // The session is on TEAM_MEMBER only; it does not open anyone else.
    await expect(
      loadShellDataSource(sql, STAFF, { viewAsUserId: OTHER_AGENT }),
    ).rejects.toBeInstanceOf(ViewAsRefusedError);

    await endImpersonation(sql, { sessionId: session.id, staffUserId: STAFF });
    await expect(
      loadShellDataSource(sql, STAFF, { viewAsUserId: TEAM_MEMBER }),
    ).rejects.toBeInstanceOf(ViewAsRefusedError);
  });
});
