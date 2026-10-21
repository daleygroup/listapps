import { createHash, randomBytes } from "node:crypto";
import type { Sql } from "postgres";
import { withUser } from "@/lib/db/session";
import { removeMembership } from "./offboarding";

/**
 * Invitations (Milestone 1, M1-6). An invitation is an account_memberships row
 * in status `invited`; accepting it attaches the person and makes it active.
 *
 *  - Inviting runs as the inviter, so RLS decides: `members.invite` at that
 *    account or above, never a role above your own, broker of record only by
 *    an owner.
 *  - Only a SHA-256 hash of the link token is stored. The raw token is
 *    returned once, to the caller that sends the email (D-005), and is never
 *    written to the database, events, or logs.
 *  - Accepting is the one place a person is attached to a membership. It runs
 *    with server privileges and checks: token matches, still invited, not
 *    expired, the signed-in email matches the invited email, and the account's
 *    contact policy has been shown and acknowledged when one is set.
 *  - Revoking an invitation reuses the offboarding removal (status `removed`,
 *    never deleted).
 */

export class InvitationError extends Error {}

export type InviteRole = "owner" | "admin" | "member";

export const DEFAULT_INVITE_TTL_HOURS = 24 * 7;
const MAX_INVITE_TTL_HOURS = 24 * 30;

/** The path the emailed link points at. The page lands with M1-5. */
export function acceptPath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  // Deliberately loose; the email service is the real check.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new InvitationError("That does not look like an email address");
  }
  return e;
}

function expiryFrom(now: Date, ttlHours: number): Date {
  if (!(ttlHours > 0) || ttlHours > MAX_INVITE_TTL_HOURS) {
    throw new InvitationError(
      `Invitations last between 1 hour and ${MAX_INVITE_TTL_HOURS / 24} days`,
    );
  }
  return new Date(now.getTime() + ttlHours * 3_600_000);
}

export interface CreatedInvitation {
  membershipId: string;
  email: string;
  expiresAt: Date;
  /** Raw link token. Hand it to the email sender and drop it. */
  token: string;
  acceptPath: string;
}

export async function createInvitation(
  sql: Sql,
  input: {
    accountId: string;
    email: string;
    role: InviteRole;
    isBrokerOfRecord?: boolean;
    actorUserId: string;
    now?: Date;
    ttlHours?: number;
  },
): Promise<CreatedInvitation> {
  const email = normalizeEmail(input.email);
  const now = input.now ?? new Date();
  const expiresAt = expiryFrom(now, input.ttlHours ?? DEFAULT_INVITE_TTL_HOURS);
  const token = newToken();

  const membershipId = await withUser(sql, input.actorUserId, async (tx) => {
    const [account] = await tx<{ account_type: string }[]>`
      select account_type from public.accounts where id = ${input.accountId}`;
    if (!account) throw new InvitationError("Account not found");
    if (account.account_type === "individual") {
      throw new InvitationError("Personal accounts do not take invitations");
    }
    const [{ allowed }] = await tx<{ allowed: boolean }[]>`
      select app_private.has_permission(${input.accountId}, 'members.invite') as allowed`;
    if (!allowed) {
      throw new InvitationError(
        "You do not have permission to invite people here",
      );
    }
    const [{ rank }] = await tx<{ rank: number }[]>`
      select app_private.strongest_role_rank(${input.accountId}) as rank`;
    const [{ wanted }] = await tx<{ wanted: number }[]>`
      select app_private.role_rank(${input.role}) as wanted`;
    if (wanted > rank) {
      throw new InvitationError(
        "You cannot invite someone above your own role",
      );
    }
    if (input.isBrokerOfRecord && rank < 3) {
      throw new InvitationError("Only an owner can name a broker of record");
    }

    // Already a member under this email? Visible to the inviter through RLS.
    const [existing] = await tx<{ status: string }[]>`
      select m.status from public.account_memberships m
      left join public.users u on u.id = m.user_id
      where m.account_id = ${input.accountId} and m.status <> 'removed'
        and (m.invited_email = ${email} or u.email = ${email})
      limit 1`;
    if (existing) {
      throw new InvitationError(
        existing.status === "invited"
          ? "That person already has an open invitation; resend it instead"
          : "That person is already a member of this account",
      );
    }

    const [row] = await tx<{ id: string }[]>`
      insert into public.account_memberships
        (account_id, role, is_broker_of_record, status, invited_email,
         invite_token_hash, invite_expires_at, invited_by_user_id)
      values (${input.accountId}, ${input.role}, ${input.isBrokerOfRecord ?? false},
              'invited', ${email}, ${hashInviteToken(token)}, ${expiresAt},
              ${input.actorUserId})
      returning id`;
    return row.id;
  });
  await recordEvent(sql, {
    accountId: input.accountId,
    actorUserId: input.actorUserId,
    eventType: "invitation.created",
    membershipId,
    payload: { role: input.role, expires_at: expiresAt.toISOString() },
  });
  return {
    membershipId,
    email,
    expiresAt,
    token,
    acceptPath: acceptPath(token),
  };
}

/** Events are server-written, after the RLS-checked change has committed. */
async function recordEvent(
  sql: Sql,
  e: {
    accountId: string;
    actorUserId: string;
    eventType: string;
    membershipId: string;
    payload: Record<string, string>;
  },
): Promise<void> {
  await sql`
    insert into public.events (account_id, actor_user_id, event_type, subject_type, subject_id, payload)
    values (${e.accountId}, ${e.actorUserId}, ${e.eventType}, 'account_memberships',
            ${e.membershipId}, ${sql.json(e.payload)})`;
}

/**
 * New link and new expiry for an open invitation. The old link stops working.
 * Needs `members.manage`, the same as changing anything else on a membership.
 */
export async function resendInvitation(
  sql: Sql,
  input: {
    membershipId: string;
    actorUserId: string;
    now?: Date;
    ttlHours?: number;
  },
): Promise<CreatedInvitation> {
  const now = input.now ?? new Date();
  const expiresAt = expiryFrom(now, input.ttlHours ?? DEFAULT_INVITE_TTL_HOURS);
  const token = newToken();
  const m = await withUser(sql, input.actorUserId, async (tx) => {
    const [m] = await tx<
      { account_id: string; status: string; invited_email: string }[]
    >`
      select account_id, status, invited_email from public.account_memberships
      where id = ${input.membershipId}`;
    if (!m || m.status !== "invited") {
      throw new InvitationError("Invitation not found or no longer open");
    }
    const updated = await tx`
      update public.account_memberships
      set invite_token_hash = ${hashInviteToken(token)}, invite_expires_at = ${expiresAt}
      where id = ${input.membershipId} and status = 'invited'`;
    if (updated.count !== 1) {
      throw new InvitationError("You do not have permission to resend this");
    }
    return m;
  });
  await recordEvent(sql, {
    accountId: m.account_id,
    actorUserId: input.actorUserId,
    eventType: "invitation.resent",
    membershipId: input.membershipId,
    payload: { expires_at: expiresAt.toISOString() },
  });
  return {
    membershipId: input.membershipId,
    email: m.invited_email,
    expiresAt,
    token,
    acceptPath: acceptPath(token),
  };
}

/** Withdraw an open invitation. The row stays, as `removed`. */
export async function revokeInvitation(
  sql: Sql,
  input: { membershipId: string; actorUserId: string; reason?: string },
): Promise<void> {
  const [m] = await sql<{ status: string }[]>`
    select status from public.account_memberships where id = ${input.membershipId}`;
  if (!m || m.status !== "invited") {
    throw new InvitationError("Invitation not found or no longer open");
  }
  await removeMembership(sql, {
    membershipId: input.membershipId,
    actorUserId: input.actorUserId,
    reason: input.reason ?? "invitation revoked",
  });
}

export type InvitationState = "open" | "expired" | "used";

export interface InvitationPreview {
  membershipId: string;
  state: InvitationState;
  accountName: string;
  accountType: string;
  role: InviteRole;
  invitedEmail: string;
  inviterName: string | null;
  expiresAt: Date | null;
  /** Shown to the person before they accept (CLAUDE.md section 4, contacts). */
  contactRetentionPolicy: string | null;
}

/**
 * What the accept page shows before sign-in. Server-side lookup by token hash;
 * an unknown token returns null so the page cannot be used to probe accounts.
 */
export async function previewInvitation(
  sql: Sql,
  input: { token: string; now?: Date },
): Promise<InvitationPreview | null> {
  if (!input.token) return null;
  const now = input.now ?? new Date();
  const [row] = await sql<
    {
      id: string;
      status: string;
      role: InviteRole;
      invited_email: string;
      invite_expires_at: Date | null;
      account_name: string;
      account_type: string;
      contact_retention_policy: string | null;
      inviter_name: string | null;
    }[]
  >`
    select m.id, m.status, m.role, m.invited_email, m.invite_expires_at,
           a.name as account_name, a.account_type, a.contact_retention_policy,
           coalesce(u.full_name, u.email::text) as inviter_name
    from public.account_memberships m
    join public.accounts a on a.id = m.account_id
    left join public.users u on u.id = m.invited_by_user_id
    where m.invite_token_hash = ${hashInviteToken(input.token)}`;
  if (!row || row.status === "removed") return null;
  const state: InvitationState =
    row.status !== "invited"
      ? "used"
      : row.invite_expires_at && row.invite_expires_at <= now
        ? "expired"
        : "open";
  return {
    membershipId: row.id,
    state,
    accountName: row.account_name,
    accountType: row.account_type,
    role: row.role,
    invitedEmail: row.invited_email,
    inviterName: row.inviter_name,
    expiresAt: row.invite_expires_at,
    contactRetentionPolicy: row.contact_retention_policy,
  };
}

/**
 * The signed-in person accepts. `userId` must come from the authenticated
 * session, never from the browser.
 */
export async function acceptInvitation(
  sql: Sql,
  input: {
    token: string;
    userId: string;
    contactPolicyAcknowledged?: boolean;
    now?: Date;
  },
): Promise<{ membershipId: string; accountId: string }> {
  const now = input.now ?? new Date();
  if (!input.token)
    throw new InvitationError("This invitation link is not valid");
  return sql.begin(async (tx) => {
    // The audit trigger records the person accepting as the actor.
    await tx`select set_config('request.jwt.claim.sub', ${input.userId}, true)`;
    const [m] = await tx<
      {
        id: string;
        account_id: string;
        status: string;
        invited_email: string;
        invite_expires_at: Date | null;
        contact_retention_policy: string | null;
      }[]
    >`
      select m.id, m.account_id, m.status, m.invited_email::text, m.invite_expires_at,
             a.contact_retention_policy
      from public.account_memberships m
      join public.accounts a on a.id = m.account_id
      where m.invite_token_hash = ${hashInviteToken(input.token)}
      for update of m`;
    if (!m || m.status !== "invited") {
      throw new InvitationError(
        "This invitation link is not valid or was already used",
      );
    }
    if (m.invite_expires_at && m.invite_expires_at <= now) {
      throw new InvitationError(
        "This invitation has expired; ask for a new one",
      );
    }
    const [user] = await tx<{ email: string; status: string }[]>`
      select email::text, status from public.users where id = ${input.userId}`;
    if (!user || user.status !== "active") {
      throw new InvitationError("Sign in with an active account to accept");
    }
    if (user.email.toLowerCase() !== m.invited_email.toLowerCase()) {
      throw new InvitationError(
        "This invitation was sent to a different email address. Sign in with that address to accept.",
      );
    }
    if (m.contact_retention_policy && !input.contactPolicyAcknowledged) {
      throw new InvitationError(
        "Please read and acknowledge how this account handles contacts before joining",
      );
    }
    const [dupe] = await tx`
      select 1 from public.account_memberships
      where account_id = ${m.account_id} and user_id = ${input.userId} and status <> 'removed'`;
    if (dupe) {
      throw new InvitationError("You are already a member of this account");
    }
    await tx`
      update public.account_memberships
      set user_id = ${input.userId}, status = 'active', joined_at = ${now},
          invite_token_hash = null,
          contact_policy_acknowledged_at = ${m.contact_retention_policy ? now : null}
      where id = ${m.id}`;
    await tx`
      insert into public.events (account_id, actor_user_id, event_type, subject_type, subject_id, payload)
      values (${m.account_id}, ${input.userId}, 'invitation.accepted', 'account_memberships',
              ${m.id}, '{}'::jsonb)`;
    return { membershipId: m.id, accountId: m.account_id };
  }) as Promise<{ membershipId: string; accountId: string }>;
}
