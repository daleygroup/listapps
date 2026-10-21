import type { Sql, TransactionSql } from "postgres";

// ltree lives in the `extensions` schema on Supabase, so path operators are
// schema-qualified here rather than relying on the connection search_path.
import { withUser } from "@/lib/db/session";

/**
 * Offboarding is a workflow, never a silent cascade (CLAUDE.md section 4).
 *
 *  1. Removing a membership revokes access immediately (status -> removed).
 *  2. An inventory of what the person controlled in that account is written
 *     to ownership_transfers, each item defaulting to the next authority up.
 *  3. The receiving authority accepts the defaults or reassigns items.
 *  4. Nothing is deleted. Personal items are listed as not_transferable so
 *     the departing person can see they keep them.
 *
 * Milestone 1 inventory: organization agent settings (stay with the account)
 * and the agent's own profile (always theirs). Later milestones add listings,
 * generated assets, Curb pages, and open Openly claims to `collectInventory`.
 */

export class OffboardingError extends Error {}

export interface RemovalResult {
  membershipId: string;
  defaultToUserId: string | null;
  transferIds: string[];
}

export async function removeMembership(
  sql: Sql,
  input: { membershipId: string; actorUserId: string; reason?: string },
): Promise<RemovalResult> {
  // 1. The removal itself runs as the actor, so RLS and the membership
  //    triggers (no role above your own, never the last owner) all apply.
  const removed = await withUser(sql, input.actorUserId, async (tx) => {
    const [m] = await tx<
      {
        id: string;
        account_id: string;
        user_id: string | null;
        status: string;
      }[]
    >`
      select id, account_id, user_id, status from public.account_memberships where id = ${input.membershipId}`;
    if (!m) throw new OffboardingError("Membership not found");
    if (m.status === "removed")
      throw new OffboardingError("Membership is already removed");
    const [{ allowed }] = await tx<{ allowed: boolean }[]>`
      select app_private.has_permission(${m.account_id}, 'members.manage') as allowed`;
    if (!allowed)
      throw new OffboardingError(
        "You do not have permission to remove members here",
      );
    const updated = await tx`
      update public.account_memberships
      set status = 'removed', removed_by_user_id = ${input.actorUserId}
      where id = ${m.id} returning id`;
    if (updated.count !== 1) {
      throw new OffboardingError(
        "You cannot remove someone whose role is above your own",
      );
    }
    return m;
  });

  // An invitation that was never accepted has nothing to hand off.
  if (!removed.user_id) {
    return { membershipId: removed.id, defaultToUserId: null, transferIds: [] };
  }
  const departingUserId = removed.user_id;

  // 2. The inventory is written by the server on the actor's behalf.
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${input.actorUserId}, true)`;
    const defaultTo = await nextAuthorityUp(
      tx,
      removed.account_id,
      departingUserId,
    );
    const items = await collectInventory(
      tx,
      removed.account_id,
      departingUserId,
    );

    const transferIds: string[] = [];
    for (const item of items) {
      const [row] = await tx<{ id: string }[]>`
        insert into public.ownership_transfers
          (account_id, membership_id, item_type, item_id, from_user_id, default_to_user_id, status, reason)
        values (${item.accountId}, ${removed.id}, ${item.itemType}, ${item.itemId}, ${departingUserId},
                ${item.transferable ? defaultTo : null},
                ${item.transferable ? "pending" : "not_transferable"},
                ${input.reason ?? null})
        returning id`;
      transferIds.push(row.id);
    }

    await tx`
      insert into public.events (account_id, actor_user_id, event_type, subject_type, subject_id, payload)
      values (${removed.account_id}, ${input.actorUserId}, 'membership.removed', 'account_memberships',
              ${removed.id}, ${tx.json({ items: transferIds.length })})`;

    return {
      membershipId: removed.id,
      defaultToUserId: defaultTo,
      transferIds,
    };
  });
}

/** Accept every pending default on one person's hand-off list. */
export async function acceptDefaults(
  sql: Sql,
  input: { membershipId: string; actorUserId: string },
): Promise<number> {
  return withUser(sql, input.actorUserId, async (tx) => {
    const r = await tx`
      update public.ownership_transfers
      set status = 'accepted', to_user_id = default_to_user_id, actor_user_id = ${input.actorUserId}
      where membership_id = ${input.membershipId} and status = 'pending'
        and default_to_user_id is not null`;
    return r.count;
  });
}

/** Send one item somewhere other than the default. */
export async function reassignTransfer(
  sql: Sql,
  input: {
    transferId: string;
    toUserId: string;
    actorUserId: string;
    reason?: string;
  },
): Promise<void> {
  await withUser(sql, input.actorUserId, async (tx) => {
    const [t] = await tx<{ account_id: string }[]>`
      select account_id from public.ownership_transfers where id = ${input.transferId} and status = 'pending'`;
    if (!t)
      throw new OffboardingError("Transfer not found or already completed");
    // The new holder must actually belong at or beneath this account.
    const [{ ok }] = await tx<{ ok: boolean }[]>`
      select exists (
        select 1 from public.account_memberships m
        join public.accounts a on a.id = m.account_id
        join public.accounts t on t.id = ${t.account_id}
        where m.user_id = ${input.toUserId} and m.status = 'active' and t.path operator(extensions.@>) a.path
      ) as ok`;
    if (!ok)
      throw new OffboardingError(
        "That person is not an active member of this account",
      );
    const r = await tx`
      update public.ownership_transfers
      set status = 'reassigned', to_user_id = ${input.toUserId}, actor_user_id = ${input.actorUserId},
          reason = coalesce(${input.reason ?? null}, reason)
      where id = ${input.transferId}`;
    if (r.count !== 1)
      throw new OffboardingError("You cannot reassign this item");
  });
}

/**
 * The next authority above the departing person: another active owner of the
 * same account, else the nearest owner of an account above it.
 */
async function nextAuthorityUp(
  tx: TransactionSql,
  accountId: string,
  departingUserId: string,
): Promise<string | null> {
  const [row] = await tx<{ user_id: string }[]>`
    select m.user_id
    from public.accounts target
    join public.accounts holder on holder.path operator(extensions.@>) target.path
    join public.account_memberships m on m.account_id = holder.id
    where target.id = ${accountId}
      and m.status = 'active' and m.role = 'owner' and m.user_id <> ${departingUserId}
    order by extensions.nlevel(holder.path) desc, m.joined_at asc nulls last
    limit 1`;
  return row?.user_id ?? null;
}

interface InventoryItem {
  accountId: string;
  itemType: string;
  itemId: string;
  transferable: boolean;
}

async function collectInventory(
  tx: TransactionSql,
  accountId: string,
  userId: string,
): Promise<InventoryItem[]> {
  const items: InventoryItem[] = [];

  const settings = await tx<{ id: string; account_id: string }[]>`
    select s.id, s.account_id
    from public.organization_agent_settings s
    join public.accounts a on a.id = ${accountId}
    where s.user_id = ${userId} and s.account_path operator(extensions.<@) a.path`;
  for (const s of settings) {
    items.push({
      accountId: s.account_id,
      itemType: "organization_agent_settings",
      itemId: s.id,
      transferable: true,
    });
  }

  // Always the agent's. Listed so everyone can see it is not moving.
  const [profile] = await tx<{ id: string }[]>`
    select id from public.agent_profiles where user_id = ${userId}`;
  if (profile) {
    items.push({
      accountId,
      itemType: "agent_profiles",
      itemId: profile.id,
      transferable: false,
    });
  }
  return items;
}
