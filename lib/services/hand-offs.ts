import type { Sql } from "postgres";
import { withUser } from "@/lib/db/session";

/**
 * The hand-off screen (offboarding step 3, CLAUDE.md section 4): for the
 * signed-in person, every departure they must act on, with each item, its
 * default new holder, and who it could go to instead.
 *
 * "Must act on" means the person can change at least one still-pending item:
 * they are its default recipient, or they hold `members.manage` on its
 * account. Everything is read as that person, so Row Level Security applies.
 *
 * One server-privileged read: the departed person's name and email. Once a
 * membership is removed, RLS (correctly) stops showing that person's users
 * row to the office, but the hand-off list must still say whose items these
 * are. That read is limited to the departing user ids of transfers the
 * signed-in person could already see.
 */
export interface HandOffPerson {
  userId: string;
  name: string;
}

export interface HandOffItem {
  transferId: string;
  itemType: string;
  status: "pending" | "accepted" | "reassigned" | "not_transferable";
  defaultTo: HandOffPerson | null;
  to: HandOffPerson | null;
}

export interface HandOff {
  membershipId: string;
  accountId: string;
  accountName: string;
  departed: HandOffPerson & { email: string };
  removedAt: Date | null;
  items: HandOffItem[];
  /** Active members at or beneath the account, who may receive an item. */
  candidates: HandOffPerson[];
}

interface TransferRow {
  id: string;
  membershipId: string;
  accountId: string;
  accountName: string;
  itemType: string;
  status: HandOffItem["status"];
  fromUserId: string;
  defaultToUserId: string | null;
  toUserId: string | null;
  removedAt: Date | null;
  canAct: boolean;
}

export async function listHandOffs(
  sql: Sql,
  userId: string,
): Promise<HandOff[]> {
  const visible = await withUser(sql, userId, async (tx) => {
    // Departures with at least one pending item this person may change.
    const rows = await tx<TransferRow[]>`
      select t.id, t.membership_id as "membershipId", m.account_id as "accountId",
             a.name as "accountName",
             t.item_type as "itemType", t.status, t.from_user_id as "fromUserId",
             t.default_to_user_id as "defaultToUserId", t.to_user_id as "toUserId",
             m.removed_at as "removedAt",
             (t.status = 'pending' and (t.default_to_user_id = ${userId}
               or app_private.has_permission(t.account_id, 'members.manage'))) as "canAct"
      from public.ownership_transfers t
      join public.account_memberships m on m.id = t.membership_id
      join public.accounts a on a.id = m.account_id
      where t.membership_id in (
        select p.membership_id from public.ownership_transfers p
        where p.status = 'pending'
          and (p.default_to_user_id = ${userId}
               or app_private.has_permission(p.account_id, 'members.manage')))
      order by m.removed_at desc nulls last, t.membership_id, t.item_type`;
    if (rows.length === 0) {
      return { rows, candidates: [], names: new Map<string, string>() };
    }

    const accountIds = [...new Set(rows.map((r) => r.accountId))];
    const candidates = await tx<
      { accountId: string; userId: string; name: string }[]
    >`
      select distinct target.id as "accountId", u.id as "userId",
             coalesce(nullif(u.full_name, ''), u.email::text) as name
      from public.accounts target
      join public.accounts a on a.path operator(extensions.<@) target.path
      join public.account_memberships m on m.account_id = a.id and m.status = 'active'
      join public.users u on u.id = m.user_id
      where target.id in ${tx(accountIds)}
      order by name`;

    // Names of recipients the signed-in person can see (active members).
    const recipientIds = [
      ...new Set(
        rows.flatMap((r) => [r.defaultToUserId, r.toUserId]).filter(isId),
      ),
    ];
    const names = new Map<string, string>();
    if (recipientIds.length > 0) {
      const people = await tx<{ id: string; name: string }[]>`
        select id, coalesce(nullif(full_name, ''), email::text) as name
        from public.users where id in ${tx(recipientIds)}`;
      for (const p of people) names.set(p.id, p.name);
    }
    return { rows, candidates, names };
  });

  if (visible.rows.length === 0) return [];

  // The one server-privileged read, limited to people already on the list.
  const departedIds = [...new Set(visible.rows.map((r) => r.fromUserId))];
  const departed = new Map<string, { name: string; email: string }>();
  for (const d of await sql<{ id: string; name: string; email: string }[]>`
    select id, coalesce(nullif(full_name, ''), email::text) as name, email::text as email
    from public.users where id in ${sql(departedIds)}`) {
    departed.set(d.id, { name: d.name, email: d.email });
  }

  const person = (id: string | null): HandOffPerson | null =>
    id ? { userId: id, name: visible.names.get(id) ?? "Former member" } : null;

  const groups = new Map<string, HandOff>();
  for (const r of visible.rows) {
    let g = groups.get(r.membershipId);
    if (!g) {
      const who = departed.get(r.fromUserId);
      g = {
        membershipId: r.membershipId,
        accountId: r.accountId,
        accountName: r.accountName,
        departed: {
          userId: r.fromUserId,
          name: who?.name ?? "Former member",
          email: who?.email ?? "",
        },
        removedAt: r.removedAt,
        items: [],
        candidates: visible.candidates
          .filter(
            (c) => c.accountId === r.accountId && c.userId !== r.fromUserId,
          )
          .map((c) => ({ userId: c.userId, name: c.name })),
      };
      groups.set(r.membershipId, g);
    }
    g.items.push({
      transferId: r.id,
      itemType: r.itemType,
      status: r.status,
      defaultTo: person(r.defaultToUserId),
      to: person(r.toUserId),
    });
  }
  return [...groups.values()];
}

function isId(v: string | null): v is string {
  return v !== null;
}
