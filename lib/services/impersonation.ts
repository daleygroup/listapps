import type { Sql, TransactionSql } from "postgres";

import {
  checkImpersonatedAction,
  type ImpersonatedAction,
  type ImpersonationMode,
} from "./impersonation-policy";

/**
 * Assume identity, for ListApps platform staff only (CLAUDE.md section 4).
 *
 *  - Only active platform_staff can start a session; never a customer role.
 *    Staff accounts can never be impersonated. (Both enforced again by RLS
 *    and the impersonation_sessions trigger.)
 *  - Read-only by default. Elevating needs a stated reason and a staff member
 *    with can_elevate_impersonation; `sales` never elevates.
 *  - Every start, elevation, step-down, action (allowed or refused), and end
 *    is written to audit_logs with the session id.
 *  - Ending a session (or letting it expire) queues the notice email to the
 *    impersonated person. Sending waits on D-005 (email service); the sender
 *    will pick up rows from `listQueuedNotices` and call `markNoticeSent`.
 *
 * The banner UI arrives with authentication (M1-5); it reads
 * `getActiveSession` on every request.
 */

export class ImpersonationError extends Error {}

export interface ImpersonationSession {
  id: string;
  staffUserId: string;
  targetUserId: string;
  reason: string;
  mode: ImpersonationMode;
  startedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
}

interface Row {
  id: string;
  staff_user_id: string;
  target_user_id: string;
  reason: string;
  mode: ImpersonationMode;
  started_at: Date;
  expires_at: Date;
  ended_at: Date | null;
}

const toSession = (r: Row): ImpersonationSession => ({
  id: r.id,
  staffUserId: r.staff_user_id,
  targetUserId: r.target_user_id,
  reason: r.reason,
  mode: r.mode,
  startedAt: r.started_at,
  expiresAt: r.expires_at,
  endedAt: r.ended_at,
});

const COLUMNS =
  "id, staff_user_id, target_user_id, reason, mode, started_at, expires_at, ended_at";

/**
 * Runs `checked` as the staff member under RLS, then `record` with server
 * privileges in the SAME transaction, so the action and its audit row either
 * both happen or neither does. Staff cannot write audit rows themselves.
 */
async function asStaff<T>(
  sql: Sql,
  staffUserId: string,
  checked: (tx: TransactionSql) => Promise<T>,
  record: (tx: TransactionSql, result: T) => Promise<void>,
): Promise<T> {
  return (await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${staffUserId}, true)`;
    await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;
    await tx.unsafe("set local role authenticated");
    const result = await checked(tx);
    await tx.unsafe("reset role");
    await record(tx, result);
    return result;
  })) as T;
}

async function audit(
  tx: TransactionSql,
  input: {
    sessionId: string;
    actorUserId: string;
    action: string;
    accountId?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    after?: Record<string, unknown> | null;
    reason?: string | null;
  },
): Promise<void> {
  await tx`
    insert into public.audit_logs
      (account_id, actor_user_id, impersonation_session_id, action, target_type, target_id, after, reason)
    values (
      coalesce(${input.accountId ?? null}::uuid, app_private.platform_account_id()),
      ${input.actorUserId}, ${input.sessionId}, ${input.action},
      ${input.targetType ?? null}, ${input.targetId ?? null},
      ${input.after ? tx.json(input.after as never) : null}, ${input.reason ?? null})`;
}

/** Postgres raises insufficient_privilege (42501) for refused elevation and RLS. */
function translate(err: unknown): never {
  const e = err as { code?: string; message?: string };
  if (e?.code === "42501")
    throw new ImpersonationError(
      "This staff member is not allowed to do that while impersonating",
    );
  if (e?.message?.includes("Staff accounts cannot be impersonated"))
    throw new ImpersonationError("Staff accounts cannot be impersonated");
  throw err;
}

async function openSessionFor(
  tx: TransactionSql,
  sessionId: string,
  staffUserId: string,
): Promise<Row> {
  const [row] = await tx.unsafe<Row[]>(
    `select ${COLUMNS} from public.impersonation_sessions
     where id = $1 and staff_user_id = $2 for update`,
    [sessionId, staffUserId],
  );
  if (!row) throw new ImpersonationError("Impersonation session not found");
  if (row.ended_at) throw new ImpersonationError("This session has ended");
  const [{ expired }] = await tx<{ expired: boolean }[]>`
    select ${row.expires_at}::timestamptz <= now() as expired`;
  if (expired) throw new ImpersonationError("This session has expired");
  return row;
}

export async function startImpersonation(
  sql: Sql,
  input: {
    staffUserId: string;
    targetUserId: string;
    reason: string;
    minutes?: number;
  },
): Promise<ImpersonationSession> {
  const reason = input.reason.trim();
  if (!reason)
    throw new ImpersonationError("A reason is required to impersonate anyone");
  if (input.staffUserId === input.targetUserId)
    throw new ImpersonationError("You cannot impersonate yourself");
  const minutes = Math.min(Math.max(Math.round(input.minutes ?? 60), 5), 240);

  try {
    return await asStaff(
      sql,
      input.staffUserId,
      async (tx) => {
        const [{ staff }] = await tx<{ staff: boolean }[]>`
          select app_private.is_staff() as staff`;
        if (!staff)
          throw new ImpersonationError(
            "Only ListApps staff can impersonate anyone",
          );
        const [open] = await tx`
          select 1 from public.impersonation_sessions
          where staff_user_id = ${input.staffUserId} and ended_at is null and expires_at > now()`;
        if (open)
          throw new ImpersonationError(
            "End your current impersonation session before starting another",
          );
        const [row] = await tx.unsafe<Row[]>(
          `insert into public.impersonation_sessions
             (staff_user_id, target_user_id, reason, expires_at)
           values ($1, $2, $3, now() + make_interval(mins => $4))
           returning ${COLUMNS}`,
          [input.staffUserId, input.targetUserId, reason, minutes],
        );
        return toSession(row);
      },
      (tx, s) =>
        audit(tx, {
          sessionId: s.id,
          actorUserId: s.staffUserId,
          action: "impersonation.started",
          targetType: "users",
          targetId: s.targetUserId,
          reason,
          after: { mode: s.mode, expires_at: s.expiresAt.toISOString() },
        }),
    );
  } catch (err) {
    translate(err);
  }
}

/** The staff member's live session, if any. The banner shows whenever this is set. */
export async function getActiveSession(
  sql: Sql,
  staffUserId: string,
): Promise<ImpersonationSession | null> {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${staffUserId}, true)`;
    await tx.unsafe("set local role authenticated");
    const [row] = await tx.unsafe<Row[]>(
      `select ${COLUMNS} from public.impersonation_sessions
       where staff_user_id = $1 and ended_at is null and expires_at > now()
       order by started_at desc limit 1`,
      [staffUserId],
    );
    return row ? toSession(row) : null;
  }) as Promise<ImpersonationSession | null>;
}

export async function elevateSession(
  sql: Sql,
  input: { sessionId: string; staffUserId: string; reason: string },
): Promise<ImpersonationSession> {
  const reason = input.reason.trim();
  if (!reason)
    throw new ImpersonationError("A reason is required to take write actions");
  try {
    return await asStaff(
      sql,
      input.staffUserId,
      async (tx) => {
        const current = await openSessionFor(
          tx,
          input.sessionId,
          input.staffUserId,
        );
        if (current.mode === "elevated") return toSession(current);
        const [row] = await tx.unsafe<Row[]>(
          `update public.impersonation_sessions
           set mode = 'elevated', elevated_at = now(), elevated_reason = $2
           where id = $1 returning ${COLUMNS}`,
          [input.sessionId, reason],
        );
        return toSession(row);
      },
      (tx, s) =>
        audit(tx, {
          sessionId: s.id,
          actorUserId: s.staffUserId,
          action: "impersonation.elevated",
          targetType: "users",
          targetId: s.targetUserId,
          reason,
        }),
    );
  } catch (err) {
    translate(err);
  }
}

export async function stepDownSession(
  sql: Sql,
  input: { sessionId: string; staffUserId: string },
): Promise<ImpersonationSession> {
  return asStaff(
    sql,
    input.staffUserId,
    async (tx) => {
      await openSessionFor(tx, input.sessionId, input.staffUserId);
      const [row] = await tx.unsafe<Row[]>(
        `update public.impersonation_sessions set mode = 'read_only'
         where id = $1 returning ${COLUMNS}`,
        [input.sessionId],
      );
      return toSession(row);
    },
    (tx, s) =>
      audit(tx, {
        sessionId: s.id,
        actorUserId: s.staffUserId,
        action: "impersonation.stepped_down",
        targetType: "users",
        targetId: s.targetUserId,
      }),
  );
}

/**
 * Every action taken while impersonating goes through here before it runs.
 * Allowed actions are logged and returned; refused ones are logged too, then
 * thrown. `accountId` is the tenant the action touches, derived server-side.
 */
export async function authorizeImpersonatedAction(
  sql: Sql,
  input: {
    sessionId: string;
    staffUserId: string;
    action: ImpersonatedAction;
    accountId?: string | null;
    targetType?: string | null;
    targetId?: string | null;
  },
): Promise<void> {
  const verdict = await asStaff(
    sql,
    input.staffUserId,
    async (tx) => {
      const s = await openSessionFor(tx, input.sessionId, input.staffUserId);
      return checkImpersonatedAction(s.mode, input.action);
    },
    (tx, v) =>
      audit(tx, {
        sessionId: input.sessionId,
        actorUserId: input.staffUserId,
        action: v.allowed
          ? "impersonation.action"
          : "impersonation.action_refused",
        accountId: input.accountId,
        targetType: input.targetType,
        targetId: input.targetId,
        after: {
          name: input.action.name,
          writes: input.action.writes,
          ...(v.allowed ? {} : { refused_because: v.reason }),
        },
      }),
  );
  if (!verdict.allowed) throw new ImpersonationError(verdict.reason);
}

/** Ends the session and queues the notice to the person who was impersonated. */
export async function endImpersonation(
  sql: Sql,
  input: { sessionId: string; staffUserId: string },
): Promise<ImpersonationSession> {
  return asStaff(
    sql,
    input.staffUserId,
    async (tx) => {
      await openSessionFor(tx, input.sessionId, input.staffUserId);
      const [row] = await tx.unsafe<Row[]>(
        `update public.impersonation_sessions
         set ended_at = now(), notification_queued_at = now()
         where id = $1 returning ${COLUMNS}`,
        [input.sessionId],
      );
      return toSession(row);
    },
    (tx, s) =>
      audit(tx, {
        sessionId: s.id,
        actorUserId: s.staffUserId,
        action: "impersonation.ended",
        targetType: "users",
        targetId: s.targetUserId,
      }),
  );
}

/**
 * Server job: closes sessions that ran past their expiry without being ended
 * and queues their notices. Safe to run as often as you like.
 */
export async function closeExpiredSessions(sql: Sql): Promise<number> {
  return sql.begin(async (tx) => {
    const rows = await tx<
      { id: string; staff_user_id: string; target_user_id: string }[]
    >`
      update public.impersonation_sessions
      set ended_at = expires_at, notification_queued_at = now()
      where ended_at is null and expires_at <= now()
      returning id, staff_user_id, target_user_id`;
    for (const r of rows) {
      await audit(tx, {
        sessionId: r.id,
        actorUserId: r.staff_user_id,
        action: "impersonation.expired",
        targetType: "users",
        targetId: r.target_user_id,
      });
    }
    return rows.length;
  }) as Promise<number>;
}

export interface QueuedNotice {
  sessionId: string;
  toEmail: string;
  toName: string | null;
  staffName: string;
  startedAt: Date;
  endedAt: Date;
  mode: ImpersonationMode;
  /** The reason the staff member gave when starting the session. */
  reason: string;
  /** The reason given for elevating, if the session was ever elevated. */
  elevatedReason: string | null;
  /** Number of actions logged during the session, refused ones included. */
  actionCount: number;
}

/** Server job input for the notice sender (D-005). Oldest first. */
export async function listQueuedNotices(sql: Sql): Promise<QueuedNotice[]> {
  const rows = await sql<
    {
      id: string;
      to_email: string;
      to_name: string | null;
      staff_name: string;
      started_at: Date;
      ended_at: Date;
      mode: ImpersonationMode;
      reason: string;
      elevated_reason: string | null;
      action_count: number;
    }[]
  >`
    select s.id, t.email::text as to_email, t.full_name as to_name,
           coalesce(st.full_name, 'ListApps support') as staff_name,
           s.started_at, s.ended_at, s.mode, s.reason, s.elevated_reason,
           (select count(*)::int from public.audit_logs a
             where a.impersonation_session_id = s.id
               and a.action in ('impersonation.action', 'impersonation.action_refused')) as action_count
    from public.impersonation_sessions s
    join public.users t on t.id = s.target_user_id
    join public.users st on st.id = s.staff_user_id
    where s.notification_queued_at is not null and s.notification_sent_at is null
    order by s.notification_queued_at`;
  return rows.map((r) => ({
    sessionId: r.id,
    toEmail: r.to_email,
    toName: r.to_name,
    staffName: r.staff_name,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    mode: r.mode,
    reason: r.reason,
    elevatedReason: r.elevated_reason,
    actionCount: r.action_count,
  }));
}

export async function markNoticeSent(
  sql: Sql,
  sessionId: string,
): Promise<void> {
  await sql`
    update public.impersonation_sessions set notification_sent_at = now()
    where id = ${sessionId} and notification_sent_at is null`;
}
