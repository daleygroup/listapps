import path from "node:path";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateDown, migrateUp } from "./migrator";
import {
  startLocalPostgres,
  type LocalPostgres,
} from "./testing/local-postgres";
import { asUser, installAuthStub } from "./testing/rls";

/**
 * M1-4: proves the Milestone 1 security rules (proposal 001, approved D-003)
 * against a real Postgres with the real migrations.
 *
 * Tree used here (generic names; real ones live only in the seed file):
 *   brk-a (brokerage) ── team-a1, team-a2
 *   brk-b (brokerage, unrelated)
 */
const DIR = path.resolve(__dirname, "../../db/migrations");

let pg: LocalPostgres;
let sql: Sql;

const U = {
  brkAdmin: uid(1),
  teamOwner: uid(2),
  teamAdmin: uid(3),
  agent: uid(4),
  a2Agent: uid(5),
  bOwner: uid(6),
  staffOwner: uid(7),
  staffSales: uid(8),
  staffSupport: uid(9),
};
const A: Record<string, string> = {};

function uid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

async function createLogin(id: string, email: string, fullName: string) {
  await sql`insert into auth.users (id, email, raw_user_meta_data)
            values (${id}, ${email}, ${sql.json({ full_name: fullName })})`;
}

async function createAccount(
  key: string,
  type: string,
  parentKey: string | null,
  name: string,
) {
  const [row] = await sql<{ id: string }[]>`
    insert into public.accounts (account_type, parent_account_id, name, slug)
    values (${type}, ${parentKey ? A[parentKey] : null}, ${name}, ${key})
    returning id`;
  A[key] = row.id;
}

async function addMember(userId: string, key: string, role: string) {
  await sql`insert into public.account_memberships (account_id, user_id, role, status, joined_at)
            values (${A[key]}, ${userId}, ${role}, 'active', now())`;
}

async function individualAccountOf(userId: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    select a.id from public.accounts a
    join public.account_memberships m on m.account_id = a.id
    where m.user_id = ${userId} and a.account_type = 'individual'`;
  return row.id;
}

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id).sort();

beforeAll(async () => {
  pg = await startLocalPostgres();
  sql = postgres(pg.url, { max: 4, onnotice: () => {} });
  await installAuthStub(sql);
  await migrateUp(sql, DIR);

  for (const [name, id] of Object.entries(U)) {
    await createLogin(id, `${name.toLowerCase()}@example.test`, name);
  }
  await createAccount("brk-a", "brokerage", null, "Brokerage A");
  await createAccount("team-a1", "team", "brk-a", "Team A1");
  await createAccount("team-a2", "team", "brk-a", "Team A2");
  await createAccount("brk-b", "brokerage", null, "Brokerage B");

  await addMember(U.brkAdmin, "brk-a", "admin");
  await addMember(U.teamOwner, "team-a1", "owner");
  await addMember(U.teamAdmin, "team-a1", "admin");
  await addMember(U.agent, "team-a1", "member");
  await addMember(U.a2Agent, "team-a2", "member");
  await addMember(U.bOwner, "brk-b", "owner");

  await sql`insert into public.platform_staff (user_id, staff_role, can_elevate_impersonation) values
    (${U.staffOwner}, 'owner', true),
    (${U.staffSales}, 'sales', false),
    (${U.staffSupport}, 'support', true)`;

  await sql`insert into public.brand_kits (account_id, name, required_disclaimer_text) values
    (${A["brk-a"]}, 'Kit A', 'Each office independently owned and operated.'),
    (${A["brk-b"]}, 'Kit B', null)`;

  const [lv] = await sql<
    { id: string }[]
  >`select id from public.applications where slug = 'listvault'`;
  await sql`insert into public.subscriptions (account_id, application_id, status, includes_descendants)
            values (${A["brk-a"]}, ${lv.id}, 'active', true), (${A["brk-b"]}, ${lv.id}, 'active', true)`;

  await sql`insert into public.agent_profiles (user_id, display_name, license_number, license_state, mobile_phone)
            values (${U.agent}, 'Agent One', 'AL-1', 'AL', '205-555-0100'),
                   (${U.bOwner}, 'B Owner', 'AL-2', 'AL', '205-555-0200')`;
  await sql`insert into public.organization_agent_settings (account_id, user_id, team_title)
            values (${A["team-a1"]}, ${U.agent}, 'Buyer Specialist')`;
}, 180_000);

afterAll(async () => {
  await sql?.end();
  pg?.stop();
});

describe("migrations", () => {
  it("are reversible", async () => {
    // Exercised on a separate cluster so the shared fixture stays intact.
    const other = await startLocalPostgres();
    const s = postgres(other.url, { max: 1, onnotice: () => {} });
    try {
      await installAuthStub(s);
      expect(await migrateUp(s, DIR)).toEqual(["0001", "0002", "0003", "0004"]);
      expect(await migrateDown(s, DIR, 4)).toEqual([
        "0004",
        "0003",
        "0002",
        "0001",
      ]);
      const [{ n }] =
        await s`select count(*)::int as n from pg_tables where schemaname = 'public'`;
      expect(n).toBe(0);
      expect(await migrateUp(s, DIR)).toHaveLength(4);
    } finally {
      await s.end();
      other.stop();
    }
  });

  it("enable RLS on every public table", async () => {
    const rows = await sql<{ relname: string }[]>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rows).toEqual([]);
    const [{ n }] =
      await sql`select count(*)::int as n from pg_tables where schemaname = 'public'`;
    expect(n).toBe(17);
  });
});

describe("signup", () => {
  it("creates a users row and a personal account outside any tree", async () => {
    const acct = await individualAccountOf(U.agent);
    const [row] =
      await sql`select parent_account_id, account_type from public.accounts where id = ${acct}`;
    expect(row).toEqual({
      parent_account_id: null,
      account_type: "individual",
    });
  });
});

describe("tree rules", () => {
  it("rejects shapes the tree does not allow", async () => {
    await expect(
      sql`insert into public.accounts (account_type, parent_account_id, name, slug)
          values ('team', ${A["team-a1"]}, 'Nested team', 'nested')`,
    ).rejects.toThrow(/cannot sit under/);
    await expect(
      sql`insert into public.accounts (account_type, name, slug) values ('team', 'Orphan', 'orphan')`,
    ).rejects.toThrow(/cannot sit under/);
    await expect(
      sql`insert into public.accounts (account_type, parent_account_id, name, slug)
          values ('individual', ${A["brk-a"]}, 'Inside', 'inside')`,
    ).rejects.toThrow(/cannot sit under/);
    await expect(
      sql`insert into public.accounts (account_type, name, slug) values ('platform', 'Second', 'second')`,
    ).rejects.toThrow(/duplicate key/);
  });

  it("never lets anyone set a path by hand", async () => {
    await expect(
      sql`update public.accounts set path = 'x' where id = ${A["team-a1"]}`,
    ).rejects.toThrow(/managed by the database/);
  });

  it("never deletes accounts", async () => {
    await expect(
      sql`delete from public.accounts where id = ${A["team-a2"]}`,
    ).rejects.toThrow(/never deleted/);
  });
});

describe("a second brokerage is invisible", () => {
  for (const who of ["agent", "teamOwner", "brkAdmin"] as const) {
    it(`for ${who}`, async () => {
      await asUser(sql, U[who], async (tx) => {
        const accts = await tx<
          { id: string }[]
        >`select id from public.accounts`;
        expect(accts.map((a) => a.id)).not.toContain(A["brk-b"]);
        const ms =
          await tx`select 1 from public.account_memberships where account_id = ${A["brk-b"]}`;
        expect(ms).toHaveLength(0);
        const kits =
          await tx`select 1 from public.brand_kits where account_id = ${A["brk-b"]}`;
        expect(kits).toHaveLength(0);
        const subs =
          await tx`select 1 from public.subscriptions where account_id = ${A["brk-b"]}`;
        expect(subs).toHaveLength(0);
        const people =
          await tx`select 1 from public.users where id = ${U.bOwner}`;
        expect(people).toHaveLength(0);
        const profiles =
          await tx`select 1 from public.agent_profiles where user_id = ${U.bOwner}`;
        expect(profiles).toHaveLength(0);
      });
    });
  }

  it("and the other brokerage cannot see us", async () => {
    await asUser(sql, U.bOwner, async (tx) => {
      const accts = await tx<{ id: string }[]>`select id from public.accounts`;
      const visible = accts.map((a) => a.id);
      for (const key of ["brk-a", "team-a1", "team-a2"])
        expect(visible).not.toContain(A[key]);
      const settings =
        await tx`select 1 from public.organization_agent_settings`;
      expect(settings).toHaveLength(0);
    });
  });
});

describe("authority flows down, never up or sideways", () => {
  it("a team member sees their team and the brokerage above, not the sibling team", async () => {
    await asUser(sql, U.agent, async (tx) => {
      const accts = await tx<
        { id: string }[]
      >`select id from public.accounts where account_type <> 'individual'`;
      expect(ids(accts)).toEqual([A["brk-a"], A["team-a1"]].sort());
      // Sees the team roster, but not the brokerage-level roster above.
      const ms = await tx<
        { account_id: string }[]
      >`select account_id from public.account_memberships`;
      const accountsSeen = new Set(ms.map((m) => m.account_id));
      expect(accountsSeen.has(A["team-a1"])).toBe(true);
      expect(accountsSeen.has(A["brk-a"])).toBe(false);
      expect(accountsSeen.has(A["team-a2"])).toBe(false);
    });
  });

  it("a brokerage admin sees every team beneath", async () => {
    await asUser(sql, U.brkAdmin, async (tx) => {
      const ms = await tx<
        { user_id: string }[]
      >`select user_id from public.account_memberships`;
      const people = new Set(ms.map((m) => m.user_id));
      for (const u of [U.teamOwner, U.agent, U.a2Agent])
        expect(people.has(u)).toBe(true);
      expect(people.has(U.bOwner)).toBe(false);
    });
  });

  it("inherited brand kits and subscriptions are visible from below", async () => {
    await asUser(sql, U.agent, async (tx) => {
      const kits = await tx<
        { name: string }[]
      >`select name from public.brand_kits`;
      expect(kits.map((k) => k.name)).toEqual(["Kit A"]);
      const subs = await tx`select 1 from public.subscriptions`;
      expect(subs).toHaveLength(1);
    });
  });

  it("nobody above can see an agent's personal account", async () => {
    const personal = await individualAccountOf(U.agent);
    for (const who of [U.teamOwner, U.brkAdmin]) {
      await asUser(sql, who, async (tx) => {
        expect(
          await tx`select 1 from public.accounts where id = ${personal}`,
        ).toHaveLength(0);
      });
    }
    await asUser(sql, U.agent, async (tx) => {
      expect(
        await tx`select 1 from public.accounts where id = ${personal}`,
      ).toHaveLength(1);
    });
  });
});

describe("roles and invitations", () => {
  it("a team admin can invite a member but never an owner", async () => {
    await asUser(sql, U.teamAdmin, async (tx) => {
      await tx`insert into public.account_memberships (account_id, role, status, invited_email, invited_by_user_id)
               values (${A["team-a1"]}, 'member', 'invited', 'new@example.test', ${U.teamAdmin})`;
    });
    await expect(
      asUser(
        sql,
        U.teamAdmin,
        (tx) =>
          tx`insert into public.account_memberships (account_id, role, status, invited_email, invited_by_user_id)
           values (${A["team-a1"]}, 'owner', 'invited', 'boss@example.test', ${U.teamAdmin})`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("a team admin cannot invite anyone into the brokerage above", async () => {
    await expect(
      asUser(
        sql,
        U.teamAdmin,
        (tx) =>
          tx`insert into public.account_memberships (account_id, role, status, invited_email, invited_by_user_id)
           values (${A["brk-a"]}, 'member', 'invited', 'x@example.test', ${U.teamAdmin})`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("members cannot invite, and cannot promote themselves", async () => {
    await expect(
      asUser(
        sql,
        U.agent,
        (tx) =>
          tx`insert into public.account_memberships (account_id, role, status, invited_email, invited_by_user_id)
           values (${A["team-a1"]}, 'member', 'invited', 'y@example.test', ${U.agent})`,
      ),
    ).rejects.toThrow(/row-level security/);
    await asUser(sql, U.agent, async (tx) => {
      const r =
        await tx`update public.account_memberships set role = 'owner' where user_id = ${U.agent}`;
      expect(r.count).toBe(0);
    });
  });

  it("an invitation cannot be accepted from the browser", async () => {
    // asUser rolls back, so create the pending invitation directly.
    await sql`insert into public.account_memberships (account_id, role, status, invited_email)
              values (${A["team-a1"]}, 'member', 'invited', 'new@example.test')`;
    await expect(
      asUser(
        sql,
        U.teamOwner,
        (tx) =>
          tx`update public.account_memberships set status = 'active', user_id = ${U.a2Agent}
           where invited_email = 'new@example.test'`,
      ),
    ).rejects.toThrow(/invitation flow/);
  });

  it("the last owner cannot be removed", async () => {
    await expect(
      asUser(
        sql,
        U.teamOwner,
        (tx) =>
          tx`update public.account_memberships set status = 'removed' where user_id = ${U.teamOwner}
           and account_id = ${A["team-a1"]}`,
      ),
    ).rejects.toThrow(/last owner/);
  });

  it("an admin cannot change or remove an owner", async () => {
    await asUser(sql, U.brkAdmin, async (tx) => {
      const r =
        await tx`update public.account_memberships set status = 'removed'
                         where user_id = ${U.teamOwner} and account_id = ${A["team-a1"]}`;
      expect(r.count).toBe(0);
    });
  });

  it("removal never deletes and is audited", async () => {
    await expect(
      sql`delete from public.account_memberships where user_id = ${U.a2Agent}`,
    ).rejects.toThrow(/never deleted/);
  });
});

describe("platform staff", () => {
  it("sales can read accounts but not profiles, audit history, or agent settings", async () => {
    await asUser(sql, U.staffSales, async (tx) => {
      const accts =
        await tx`select 1 from public.accounts where id = ${A["brk-b"]}`;
      expect(accts).toHaveLength(1);
      expect(await tx`select 1 from public.agent_profiles`).toHaveLength(0);
      expect(await tx`select 1 from public.audit_logs`).toHaveLength(0);
      expect(
        await tx`select 1 from public.organization_agent_settings`,
      ).toHaveLength(0);
    });
  });

  it("support can read profiles for support work", async () => {
    await asUser(sql, U.staffSupport, async (tx) => {
      expect(
        (await tx`select 1 from public.agent_profiles`).length,
      ).toBeGreaterThan(0);
    });
  });

  it("customers cannot see the staff list", async () => {
    await asUser(sql, U.brkAdmin, async (tx) => {
      expect(await tx`select 1 from public.platform_staff`).toHaveLength(0);
    });
  });

  it("customers cannot grant themselves staff access", async () => {
    await expect(
      asUser(
        sql,
        U.brkAdmin,
        (tx) =>
          tx`insert into public.platform_staff (user_id, staff_role) values (${U.brkAdmin}, 'owner')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("impersonation", () => {
  it("support can start a read-only session; sales can never elevate", async () => {
    await asUser(sql, U.staffSupport, async (tx) => {
      const [s] = await tx<{ id: string }[]>`
        insert into public.impersonation_sessions (staff_user_id, target_user_id, reason)
        values (${U.staffSupport}, ${U.agent}, 'Help with login') returning id`;
      await tx`update public.impersonation_sessions
               set mode = 'elevated', elevated_at = now(), elevated_reason = 'Fix profile typo'
               where id = ${s.id}`;
    });
    await expect(
      asUser(sql, U.staffSales, async (tx) => {
        const [s] = await tx<{ id: string }[]>`
          insert into public.impersonation_sessions (staff_user_id, target_user_id, reason)
          values (${U.staffSales}, ${U.agent}, 'Demo prep') returning id`;
        await tx`update public.impersonation_sessions
                 set mode = 'elevated', elevated_at = now(), elevated_reason = 'x' where id = ${s.id}`;
      }),
    ).rejects.toThrow(/cannot take write actions/);
  });

  it("customers can never impersonate", async () => {
    await expect(
      asUser(
        sql,
        U.teamOwner,
        (tx) =>
          tx`insert into public.impersonation_sessions (staff_user_id, target_user_id, reason)
           values (${U.teamOwner}, ${U.agent}, 'curious')`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("staff cannot be impersonated, and the reason can never be rewritten", async () => {
    await expect(
      sql`insert into public.impersonation_sessions (staff_user_id, target_user_id, reason)
          values (${U.staffSupport}, ${U.staffOwner}, 'x')`,
    ).rejects.toThrow(/Staff accounts cannot be impersonated/);
    const [s] = await sql<{ id: string }[]>`
      insert into public.impersonation_sessions (staff_user_id, target_user_id, reason)
      values (${U.staffSupport}, ${U.agent}, 'original') returning id`;
    await expect(
      sql`update public.impersonation_sessions set reason = 'rewritten' where id = ${s.id}`,
    ).rejects.toThrow(/never change/);
  });

  it("the impersonated person can see who looked", async () => {
    await asUser(sql, U.agent, async (tx) => {
      expect(
        (await tx`select 1 from public.impersonation_sessions`).length,
      ).toBeGreaterThan(0);
    });
  });
});

describe("audit history is permanent", () => {
  it("license changes are recorded", async () => {
    await asUser(sql, U.agent, async (tx) => {
      await tx`update public.agent_profiles set license_number = 'AL-1-FIXED' where user_id = ${U.agent}`;
      const rows = await tx<
        { action: string; after: { license_number: string } }[]
      >`
        select action, after from public.audit_logs where target_type = 'agent_profiles'`;
      expect(rows.at(-1)).toEqual({
        action: "agent_profile.changed",
        after: { license_number: "AL-1-FIXED" },
      });
    });
  });

  it("disclaimer changes are recorded at the account", async () => {
    await sql`update public.brand_kits set required_disclaimer_text = 'Updated text' where account_id = ${A["brk-a"]}`;
    const [row] = await sql`select account_id, action from public.audit_logs
                            where target_type = 'brand_kits' order by occurred_at desc limit 1`;
    expect(row).toEqual({
      account_id: A["brk-a"],
      action: "brand_kit.changed",
    });
  });

  it("cannot be edited or deleted, even by the database owner", async () => {
    await expect(
      sql`update public.audit_logs set action = 'nothing happened'`,
    ).rejects.toThrow(/never be changed/);
    await expect(sql`delete from public.audit_logs`).rejects.toThrow(
      /never be deleted/,
    );
    await expect(sql`truncate public.audit_logs`).rejects.toThrow(
      /never be deleted/,
    );
  });

  it("customers cannot write audit rows directly", async () => {
    await expect(
      asUser(
        sql,
        U.teamOwner,
        (tx) =>
          tx`insert into public.audit_logs (account_id, action) values (${A["team-a1"]}, 'forged')`,
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("account_path cannot be forged", () => {
  it("is always recomputed from account_id", async () => {
    await sql`update public.organization_agent_settings set account_path = 'fake' where user_id = ${U.agent}`;
    const [row] = await sql<{ account_path: string; path: string }[]>`
      select s.account_path::text, a.path::text from public.organization_agent_settings s
      join public.accounts a on a.id = s.account_id where s.user_id = ${U.agent}`;
    expect(row.account_path).toBe(row.path);
  });
});

describe("moving an account (staff only)", () => {
  it("customers cannot move accounts", async () => {
    await expect(
      asUser(
        sql,
        U.brkAdmin,
        (tx) =>
          tx`update public.accounts set parent_account_id = ${A["brk-b"]} where id = ${A["team-a2"]}`,
      ),
    ).rejects.toThrow(/Only ListApps staff/);
  });

  it("reparenting carries every row beneath it to the new place", async () => {
    await createAccount("org-1", "organization", null, "Organization One");
    const orgOwner = uid(20);
    await createLogin(orgOwner, "orgowner@example.test", "Org Owner");
    await addMember(orgOwner, "org-1", "owner");

    await sql`select app_private.reparent_account(${A["brk-a"]}, ${A["org-1"]})`;

    const [{ ok }] = await sql`
      select bool_and(m.account_path::text = a.path::text) as ok
      from public.account_memberships m join public.accounts a on a.id = m.account_id`;
    expect(ok).toBe(true);

    await asUser(sql, orgOwner, async (tx) => {
      const ms = await tx<
        { user_id: string }[]
      >`select user_id from public.account_memberships`;
      expect(ms.map((m) => m.user_id)).toContain(U.agent);
      const settings =
        await tx`select 1 from public.organization_agent_settings`;
      expect(settings).toHaveLength(1);
    });
  });

  it("cannot be called from a browser session", async () => {
    await expect(
      asUser(
        sql,
        U.staffOwner,
        (tx) =>
          tx`select app_private.reparent_account(${A["brk-b"]}, ${A["org-1"]})`,
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
