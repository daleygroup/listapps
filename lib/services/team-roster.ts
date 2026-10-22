import type { Sql } from "postgres";
import { withUser } from "@/lib/db/session";
import type { MembershipRole } from "@/lib/resolvers";

/**
 * The "People" section of settings: every office or team the signed-in
 * person may invite into, with who is already in it and who has an open
 * invitation. Read as that person, so Row Level Security applies, and also
 * filtered to accounts where they hold `members.invite` themselves (a platform
 * staff member sees nothing here; staff use their own tools).
 *
 * Never includes invitation link tokens (only their hashes are stored).
 */
export interface RosterPerson {
  membershipId: string;
  name: string;
  email: string;
  role: MembershipRole;
  isBrokerOfRecord: boolean;
  status: "active" | "invited";
  /** Open invitations only. */
  inviteExpiresAt: Date | null;
}

export interface RosterAccount {
  accountId: string;
  name: string;
  type: string;
  people: RosterPerson[];
}

export async function listManagedRosters(
  sql: Sql,
  userId: string,
): Promise<RosterAccount[]> {
  return withUser(sql, userId, async (tx) => {
    const accounts = await tx<{ id: string; name: string; type: string }[]>`
      select a.id, a.name, a.account_type as type
      from public.accounts a
      where a.account_type not in ('platform', 'individual')
        and exists (
          select 1 from public.account_memberships m
          join public.accounts holder on holder.id = m.account_id
          where m.user_id = ${userId} and m.status = 'active'
            and holder.path operator(extensions.@>) a.path)
        and app_private.has_permission(a.id, 'members.invite')
      order by a.path`;
    if (accounts.length === 0) return [];

    const rows = await tx<(RosterPerson & { accountId: string })[]>`
      select m.id as "membershipId", m.account_id as "accountId",
             coalesce(nullif(u.full_name, ''), u.email::text, m.invited_email::text, '') as name,
             coalesce(u.email::text, m.invited_email::text, '') as email,
             m.role, m.is_broker_of_record as "isBrokerOfRecord", m.status,
             case when m.status = 'invited' then m.invite_expires_at end as "inviteExpiresAt"
      from public.account_memberships m
      left join public.users u on u.id = m.user_id
      where m.account_id in ${tx(accounts.map((a) => a.id))}
        and m.status in ('active', 'invited')
      order by m.status, lower(coalesce(u.full_name, u.email::text, m.invited_email::text))`;

    return accounts.map((a) => ({
      accountId: a.id,
      name: a.name,
      type: a.type,
      people: rows
        .filter((r) => r.accountId === a.id)
        .map((row) => toPerson(row)),
    }));
  });
}

function toPerson(row: RosterPerson & { accountId: string }): RosterPerson {
  return {
    membershipId: row.membershipId,
    name: row.name,
    email: row.email,
    role: row.role,
    isBrokerOfRecord: row.isBrokerOfRecord,
    status: row.status,
    inviteExpiresAt: row.inviteExpiresAt,
  };
}
