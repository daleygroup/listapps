import path from "node:path";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateUp } from "@/lib/db/migrator";
import {
  startLocalPostgres,
  type LocalPostgres,
} from "@/lib/db/testing/local-postgres";
import { installAuthStub } from "@/lib/db/testing/rls";
import {
  acceptInvitation,
  createInvitation,
  hashInviteToken,
  invitationEmailContext,
  previewInvitation,
  resendInvitation,
  revokeInvitation,
} from "./invitations";

let pg: LocalPostgres;
let sql: Sql;
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const OWNER = uid(1);
const ADMIN = uid(2);
const MEMBER = uid(3);
const OUTSIDER = uid(4);
const NEWBIE = uid(5);
const NEWBIE2 = uid(6);
const BROKER = uid(7);
const SNEAK = uid(8);
let brokerage = "";
let team = "";
let other = "";
let personal = "";
const NOW = new Date("2026-10-21T15:00:00Z");

beforeAll(async () => {
  pg = await startLocalPostgres();
  sql = postgres(pg.url, { max: 4, onnotice: () => {} });
  await installAuthStub(sql);
  await migrateUp(sql, path.resolve(__dirname, "../../db/migrations"));
  for (const [id, email] of [
    [OWNER, "owner@example.test"],
    [ADMIN, "admin@example.test"],
    [MEMBER, "member@example.test"],
    [OUTSIDER, "outsider@example.test"],
    [NEWBIE, "newbie@example.test"],
    [NEWBIE2, "newbie2@example.test"],
    [BROKER, "broker@example.test"],
    [SNEAK, "sneak@example.test"],
  ]) {
    await sql`insert into auth.users (id, email) values (${id}, ${email})`;
  }
  [{ id: brokerage }] =
    await sql`insert into public.accounts (account_type, name, slug)
    values ('brokerage', 'Brokerage One', 'brk-one') returning id`;
  [{ id: team }] =
    await sql`insert into public.accounts (account_type, parent_account_id, name, slug, contact_retention_policy)
    values ('team', ${brokerage}, 'Team One', 'team-one', 'Office-generated leads are also kept by the team.') returning id`;
  [{ id: other }] =
    await sql`insert into public.accounts (account_type, name, slug)
    values ('brokerage', 'Brokerage Two', 'brk-two') returning id`;
  [{ id: personal }] =
    await sql`insert into public.accounts (account_type, name, slug)
    values ('individual', 'Member Personal', 'member-personal') returning id`;
  for (const [account, user, role] of [
    [team, OWNER, "owner"],
    [team, ADMIN, "admin"],
    [team, MEMBER, "member"],
    [other, OUTSIDER, "owner"],
    [brokerage, BROKER, "owner"],
    [personal, MEMBER, "owner"],
  ] as const) {
    await sql`insert into public.account_memberships (account_id, user_id, role, status, joined_at)
      values (${account}, ${user}, ${role}, 'active', now())`;
  }
}, 120_000);

afterAll(async () => {
  await sql?.end();
  pg?.stop();
});

describe("creating invitations", () => {
  it("members cannot invite", async () => {
    await expect(
      createInvitation(sql, {
        accountId: team,
        email: "x@example.test",
        role: "member",
        actorUserId: MEMBER,
        now: NOW,
      }),
    ).rejects.toThrow(/permission/);
  });

  it("another brokerage's owner cannot invite into this team", async () => {
    await expect(
      createInvitation(sql, {
        accountId: team,
        email: "x@example.test",
        role: "member",
        actorUserId: OUTSIDER,
        now: NOW,
      }),
    ).rejects.toThrow(/not found|permission/);
  });

  it("an admin cannot invite an owner or a broker of record", async () => {
    await expect(
      createInvitation(sql, {
        accountId: team,
        email: "x@example.test",
        role: "owner",
        actorUserId: ADMIN,
        now: NOW,
      }),
    ).rejects.toThrow(/above your own role/);
    await expect(
      createInvitation(sql, {
        accountId: team,
        email: "x@example.test",
        role: "member",
        isBrokerOfRecord: true,
        actorUserId: ADMIN,
        now: NOW,
      }),
    ).rejects.toThrow(/broker of record/);
  });

  it("personal accounts do not take invitations", async () => {
    await expect(
      createInvitation(sql, {
        accountId: personal,
        email: "x@example.test",
        role: "member",
        actorUserId: MEMBER,
        now: NOW,
      }),
    ).rejects.toThrow(/Personal accounts/);
  });

  it("an admin invites a member; only the hash is stored", async () => {
    const inv = await createInvitation(sql, {
      accountId: team,
      email: "  NewBie@Example.test ",
      role: "member",
      actorUserId: ADMIN,
      now: NOW,
    });
    expect(inv.email).toBe("newbie@example.test");
    expect(inv.token.length).toBeGreaterThanOrEqual(40);
    expect(inv.acceptPath).toContain(inv.token);
    expect(inv.expiresAt.getTime() - NOW.getTime()).toBe(7 * 86_400_000);
    const [row] = await sql`
      select status, invite_token_hash, invited_by_user_id
      from public.account_memberships where id = ${inv.membershipId}`;
    expect(row.status).toBe("invited");
    expect(row.invited_by_user_id).toBe(ADMIN);
    expect(row.invite_token_hash).toBe(hashInviteToken(inv.token));
    // The raw token is nowhere in the database.
    const [{ hits }] = await sql`
      select count(*)::int as hits from public.events where payload::text like ${"%" + inv.token + "%"}`;
    expect(hits).toBe(0);
    const [{ n }] = await sql`
      select count(*)::int as n from public.events
      where event_type = 'invitation.created' and subject_id = ${inv.membershipId}`;
    expect(n).toBe(1);
  });

  it("refuses a second open invitation or an existing member", async () => {
    await expect(
      createInvitation(sql, {
        accountId: team,
        email: "newbie@example.test",
        role: "member",
        actorUserId: OWNER,
        now: NOW,
      }),
    ).rejects.toThrow(/open invitation/);
    await expect(
      createInvitation(sql, {
        accountId: team,
        email: "member@example.test",
        role: "member",
        actorUserId: OWNER,
        now: NOW,
      }),
    ).rejects.toThrow(/already a member/);
  });

  it("a brokerage owner can invite into the team below (authority flows down)", async () => {
    const inv = await createInvitation(sql, {
      accountId: team,
      email: "newbie2@example.test",
      role: "admin",
      actorUserId: BROKER,
      now: NOW,
    });
    expect(inv.membershipId).toBeTruthy();
  });
});

describe("previewing and accepting", () => {
  it("an unknown token reveals nothing", async () => {
    expect(
      await previewInvitation(sql, { token: "nope", now: NOW }),
    ).toBeNull();
    await expect(
      acceptInvitation(sql, { token: "nope", userId: NEWBIE, now: NOW }),
    ).rejects.toThrow(/not valid/);
  });

  it("previews, then enforces email match, policy acknowledgement, and expiry", async () => {
    const inv = await createInvitation(sql, {
      accountId: team,
      email: "sneak-target@example.test",
      role: "member",
      actorUserId: OWNER,
      now: NOW,
    });
    const p = await previewInvitation(sql, { token: inv.token, now: NOW });
    expect(p).toMatchObject({
      state: "open",
      accountName: "Team One",
      role: "member",
      invitedEmail: "sneak-target@example.test",
      contactRetentionPolicy: expect.stringContaining("Office-generated"),
    });
    // A forwarded link does not work for someone else.
    await expect(
      acceptInvitation(sql, {
        token: inv.token,
        userId: SNEAK,
        contactPolicyAcknowledged: true,
        now: NOW,
      }),
    ).rejects.toThrow(/different email/);
    const late = new Date(NOW.getTime() + 8 * 86_400_000);
    expect(
      (await previewInvitation(sql, { token: inv.token, now: late }))?.state,
    ).toBe("expired");
  });

  it("expired invitations cannot be accepted", async () => {
    const inv = await createInvitation(sql, {
      accountId: brokerage,
      email: "newbie@example.test",
      role: "member",
      actorUserId: BROKER,
      now: NOW,
      ttlHours: 1,
    });
    await expect(
      acceptInvitation(sql, {
        token: inv.token,
        userId: NEWBIE,
        now: new Date(NOW.getTime() + 2 * 3_600_000),
      }),
    ).rejects.toThrow(/expired/);
  });

  it("the invited person accepts after acknowledging the contact policy", async () => {
    const inv = await resendInvitation(sql, {
      membershipId: (
        await sql`select id from public.account_memberships
          where account_id = ${team} and invited_email = 'newbie@example.test' and status = 'invited'`
      )[0].id,
      actorUserId: ADMIN,
      now: NOW,
    });
    await expect(
      acceptInvitation(sql, { token: inv.token, userId: NEWBIE, now: NOW }),
    ).rejects.toThrow(/acknowledge/);
    const r = await acceptInvitation(sql, {
      token: inv.token,
      userId: NEWBIE,
      contactPolicyAcknowledged: true,
      now: NOW,
    });
    expect(r.accountId).toBe(team);
    const [m] = await sql`
      select status, user_id, joined_at, invite_token_hash, contact_policy_acknowledged_at
      from public.account_memberships where id = ${r.membershipId}`;
    expect(m.status).toBe("active");
    expect(m.user_id).toBe(NEWBIE);
    expect(m.invite_token_hash).toBeNull();
    expect(m.contact_policy_acknowledged_at).not.toBeNull();
    // The link is single-use.
    await expect(
      acceptInvitation(sql, {
        token: inv.token,
        userId: NEWBIE,
        contactPolicyAcknowledged: true,
        now: NOW,
      }),
    ).rejects.toThrow(/not valid|already used/);
    // The membership change is in the audit history with the person as actor.
    const [{ n }] = await sql`
      select count(*)::int as n from public.audit_logs
      where target_id = ${r.membershipId} and actor_user_id = ${NEWBIE}`;
    expect(n).toBeGreaterThanOrEqual(1);
  });

  it("resending replaces the link; the old one stops working", async () => {
    const first = await createInvitation(sql, {
      accountId: other,
      email: "newbie2@example.test",
      role: "member",
      actorUserId: OUTSIDER,
      now: NOW,
    });
    const second = await resendInvitation(sql, {
      membershipId: first.membershipId,
      actorUserId: OUTSIDER,
      now: NOW,
    });
    expect(second.token).not.toBe(first.token);
    expect(
      await previewInvitation(sql, { token: first.token, now: NOW }),
    ).toBeNull();
    // Someone from the first brokerage cannot resend it.
    await expect(
      resendInvitation(sql, {
        membershipId: first.membershipId,
        actorUserId: BROKER,
        now: NOW,
      }),
    ).rejects.toThrow(/not found|permission/);
  });
});

describe("revoking", () => {
  it("a revoked invitation stays on record as removed and cannot be accepted", async () => {
    const inv = await createInvitation(sql, {
      accountId: team,
      email: "revoked@example.test",
      role: "member",
      actorUserId: ADMIN,
      now: NOW,
    });
    await expect(
      revokeInvitation(sql, {
        membershipId: inv.membershipId,
        actorUserId: MEMBER,
      }),
    ).rejects.toThrow(/permission/);
    await revokeInvitation(sql, {
      membershipId: inv.membershipId,
      actorUserId: ADMIN,
    });
    const [m] = await sql`
      select status from public.account_memberships where id = ${inv.membershipId}`;
    expect(m.status).toBe("removed");
    expect(
      await previewInvitation(sql, { token: inv.token, now: NOW }),
    ).toBeNull();
  });
});

describe("invitation email context", () => {
  it("gives the inviter what the email needs, never the token", async () => {
    await sql`update public.users set full_name = 'Olive Owner' where id = ${OWNER}`;
    const inv = await createInvitation(sql, {
      accountId: team,
      email: "context@example.test",
      role: "admin",
      actorUserId: OWNER,
      now: NOW,
    });
    const ctx = await invitationEmailContext(sql, {
      membershipId: inv.membershipId,
      actorUserId: OWNER,
    });
    expect(ctx).toEqual({
      email: "context@example.test",
      role: "admin",
      expiresAt: inv.expiresAt,
      accountName: "Team One",
      accountTimeZone: "America/Chicago",
      inviterName: "Olive Owner",
    });
    expect(JSON.stringify(ctx)).not.toContain(inv.token);
    expect(JSON.stringify(ctx)).not.toContain(hashInviteToken(inv.token));
  });

  it("shows nothing to someone in another brokerage, or once withdrawn", async () => {
    const inv = await createInvitation(sql, {
      accountId: team,
      email: "context2@example.test",
      role: "member",
      actorUserId: OWNER,
      now: NOW,
    });
    expect(
      await invitationEmailContext(sql, {
        membershipId: inv.membershipId,
        actorUserId: OUTSIDER,
      }),
    ).toBeNull();
    await revokeInvitation(sql, {
      membershipId: inv.membershipId,
      actorUserId: OWNER,
    });
    expect(
      await invitationEmailContext(sql, {
        membershipId: inv.membershipId,
        actorUserId: OWNER,
      }),
    ).toBeNull();
  });
});
