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
  authorizeImpersonatedAction,
  closeExpiredSessions,
  elevateSession,
  endImpersonation,
  getActiveSession,
  listQueuedNotices,
  markNoticeSent,
  startImpersonation,
  stepDownSession,
} from "./impersonation";

let pg: LocalPostgres;
let sql: Sql;
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SUPPORT = uid(1); // support, can elevate
const SALES = uid(2); // sales, never elevates
const PLAIN_SUPPORT = uid(3); // support without elevation
const AGENT = uid(4);
const OWNER = uid(5); // brokerage owner, a customer
const OTHER_AGENT = uid(6);

beforeAll(async () => {
  pg = await startLocalPostgres();
  sql = postgres(pg.url, { max: 4, onnotice: () => {} });
  await installAuthStub(sql);
  await migrateUp(sql, path.resolve(__dirname, "../../db/migrations"));
  for (const [id, email] of [
    [SUPPORT, "support@example.test"],
    [SALES, "sales@example.test"],
    [PLAIN_SUPPORT, "plain@example.test"],
    [AGENT, "agent@example.test"],
    [OWNER, "owner@example.test"],
    [OTHER_AGENT, "other@example.test"],
  ]) {
    await sql`insert into auth.users (id, email) values (${id}, ${email})`;
  }
  await sql`update public.users set full_name = 'Sam Support' where id = ${SUPPORT}`;
  await sql`update public.users set full_name = 'Avery Agent' where id = ${AGENT}`;
  await sql`insert into public.platform_staff (user_id, staff_role, can_elevate_impersonation) values
    (${SUPPORT}, 'support', true), (${SALES}, 'sales', false), (${PLAIN_SUPPORT}, 'support', false)`;
  const [{ id: brokerage }] =
    await sql`insert into public.accounts (account_type, name, slug)
    values ('brokerage', 'Brokerage', 'brk') returning id`;
  await sql`insert into public.account_memberships (account_id, user_id, role, status, joined_at) values
    (${brokerage}, ${OWNER}, 'owner', 'active', now()),
    (${brokerage}, ${AGENT}, 'member', 'active', now())`;
}, 120_000);

afterAll(async () => {
  await sql?.end();
  pg?.stop();
});

const auditFor = (sessionId: string) =>
  sql<
    {
      action: string;
      reason: string | null;
      after: Record<string, unknown> | null;
    }[]
  >`
    select action, reason, after from public.audit_logs
    where impersonation_session_id = ${sessionId} order by occurred_at, created_at`;

describe("impersonation", () => {
  it("customers, even a brokerage owner, can never impersonate", async () => {
    await expect(
      startImpersonation(sql, {
        staffUserId: OWNER,
        targetUserId: AGENT,
        reason: "checking on them",
      }),
    ).rejects.toThrow(/Only ListApps staff/);
  });

  it("requires a reason", async () => {
    await expect(
      startImpersonation(sql, {
        staffUserId: SUPPORT,
        targetUserId: AGENT,
        reason: "   ",
      }),
    ).rejects.toThrow(/reason is required/);
  });

  it("staff accounts can never be impersonated", async () => {
    await expect(
      startImpersonation(sql, {
        staffUserId: SUPPORT,
        targetUserId: SALES,
        reason: "test",
      }),
    ).rejects.toThrow(/Staff accounts cannot be impersonated/);
  });

  it("runs the full read-only, elevate, step down, end cycle with a complete log", async () => {
    const s = await startImpersonation(sql, {
      staffUserId: SUPPORT,
      targetUserId: AGENT,
      reason: "Ticket 42: listing not showing",
    });
    expect(s.mode).toBe("read_only");
    expect((await getActiveSession(sql, SUPPORT))?.id).toBe(s.id);

    // Only one live session per staff member.
    await expect(
      startImpersonation(sql, {
        staffUserId: SUPPORT,
        targetUserId: OTHER_AGENT,
        reason: "another",
      }),
    ).rejects.toThrow(/End your current/);

    // Reads are fine; writes are refused (and logged) until elevated.
    await authorizeImpersonatedAction(sql, {
      sessionId: s.id,
      staffUserId: SUPPORT,
      action: { name: "listing.view", writes: false },
    });
    await expect(
      authorizeImpersonatedAction(sql, {
        sessionId: s.id,
        staffUserId: SUPPORT,
        action: { name: "listing.update", writes: true },
      }),
    ).rejects.toThrow(/read-only/);

    await expect(
      elevateSession(sql, {
        sessionId: s.id,
        staffUserId: SUPPORT,
        reason: "",
      }),
    ).rejects.toThrow(/reason is required/);
    const up = await elevateSession(sql, {
      sessionId: s.id,
      staffUserId: SUPPORT,
      reason: "Agent asked us to fix the address",
    });
    expect(up.mode).toBe("elevated");
    await authorizeImpersonatedAction(sql, {
      sessionId: s.id,
      staffUserId: SUPPORT,
      action: { name: "listing.update", writes: true },
    });
    // Never permitted, even elevated.
    await expect(
      authorizeImpersonatedAction(sql, {
        sessionId: s.id,
        staffUserId: SUPPORT,
        action: { name: "contacts.export", writes: false },
      }),
    ).rejects.toThrow(/never be exported/);

    const down = await stepDownSession(sql, {
      sessionId: s.id,
      staffUserId: SUPPORT,
    });
    expect(down.mode).toBe("read_only");

    const ended = await endImpersonation(sql, {
      sessionId: s.id,
      staffUserId: SUPPORT,
    });
    expect(ended.endedAt).not.toBeNull();
    expect(await getActiveSession(sql, SUPPORT)).toBeNull();
    await expect(
      authorizeImpersonatedAction(sql, {
        sessionId: s.id,
        staffUserId: SUPPORT,
        action: { name: "listing.view", writes: false },
      }),
    ).rejects.toThrow(/ended/);

    const log = await auditFor(s.id);
    expect(log.map((l) => l.action)).toEqual([
      "impersonation.started",
      "impersonation.action",
      "impersonation.action_refused",
      "impersonation.elevated",
      "impersonation.action",
      "impersonation.action_refused",
      "impersonation.stepped_down",
      "impersonation.ended",
    ]);
    expect(log[0].reason).toBe("Ticket 42: listing not showing");
    expect(log[3].reason).toBe("Agent asked us to fix the address");

    // The notice to the agent is queued, then marked sent exactly once.
    const notices = await listQueuedNotices(sql);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      sessionId: s.id,
      toEmail: "agent@example.test",
      toName: "Avery Agent",
      staffName: "Sam Support",
      actionCount: 4,
    });
    await markNoticeSent(sql, s.id);
    expect(await listQueuedNotices(sql)).toHaveLength(0);
  });

  it("sales staff stay read-only, always", async () => {
    const s = await startImpersonation(sql, {
      staffUserId: SALES,
      targetUserId: AGENT,
      reason: "demo walkthrough",
    });
    await expect(
      elevateSession(sql, {
        sessionId: s.id,
        staffUserId: SALES,
        reason: "please",
      }),
    ).rejects.toThrow(/not allowed/);
    // The refused elevation left nothing behind: still read-only, no audit row for it.
    expect((await getActiveSession(sql, SALES))?.mode).toBe("read_only");
    expect((await auditFor(s.id)).map((l) => l.action)).toEqual([
      "impersonation.started",
    ]);
    await endImpersonation(sql, { sessionId: s.id, staffUserId: SALES });
  });

  it("support without the elevation permission cannot elevate", async () => {
    const s = await startImpersonation(sql, {
      staffUserId: PLAIN_SUPPORT,
      targetUserId: AGENT,
      reason: "look only",
    });
    await expect(
      elevateSession(sql, {
        sessionId: s.id,
        staffUserId: PLAIN_SUPPORT,
        reason: "x",
      }),
    ).rejects.toThrow(/not allowed/);
    await endImpersonation(sql, {
      sessionId: s.id,
      staffUserId: PLAIN_SUPPORT,
    });
  });

  it("one staff member cannot drive another's session", async () => {
    const s = await startImpersonation(sql, {
      staffUserId: SUPPORT,
      targetUserId: OTHER_AGENT,
      reason: "ticket 7",
    });
    await expect(
      endImpersonation(sql, { sessionId: s.id, staffUserId: PLAIN_SUPPORT }),
    ).rejects.toThrow(/not found/);
    await endImpersonation(sql, { sessionId: s.id, staffUserId: SUPPORT });
  });

  it("expired sessions are closed by the sweep and their notices queued", async () => {
    const s = await startImpersonation(sql, {
      staffUserId: SUPPORT,
      targetUserId: AGENT,
      reason: "left open by mistake",
    });
    // Simulate the clock running past the expiry (started_at is immutable by design).
    await sql`update public.impersonation_sessions
              set expires_at = now() - interval '1 second' where id = ${s.id}`;
    expect(await getActiveSession(sql, SUPPORT)).toBeNull();
    await expect(
      authorizeImpersonatedAction(sql, {
        sessionId: s.id,
        staffUserId: SUPPORT,
        action: { name: "listing.view", writes: false },
      }),
    ).rejects.toThrow(/expired/);
    const before = (await listQueuedNotices(sql)).length;
    expect(await closeExpiredSessions(sql)).toBeGreaterThanOrEqual(1);
    expect(await closeExpiredSessions(sql)).toBe(0);
    const notices = await listQueuedNotices(sql);
    expect(notices.length).toBe(before + 1);
    expect(notices.some((n) => n.sessionId === s.id)).toBe(true);
    expect((await auditFor(s.id)).map((l) => l.action)).toContain(
      "impersonation.expired",
    );
  });

  it("the impersonated person can see that it happened", async () => {
    const seen = await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${AGENT}, true)`;
      await tx.unsafe("set local role authenticated");
      return tx`select id from public.impersonation_sessions`;
    });
    expect(seen.length).toBeGreaterThanOrEqual(3);
    const ownerSees = await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${OWNER}, true)`;
      await tx.unsafe("set local role authenticated");
      return tx`select id from public.impersonation_sessions`;
    });
    expect(ownerSees).toHaveLength(0);
  });
});
