import { AccountTree } from "./tree";
import type { Membership, MembershipRole, RolePermission } from "./types";

/**
 * Customer authority. A membership grants authority over its account and every
 * account beneath it, never above or sideways. What you may DO comes from
 * role_permissions rows keyed by the type of the account you hold the role on.
 *
 * This mirrors the RLS policies; the database enforces the same rules again.
 * Platform staff never resolve through here (they are not customers).
 */

const ROLE_RANK: Record<MembershipRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

export interface AuthorityContext {
  tree: AccountTree;
  memberships: readonly Membership[];
  rolePermissions: readonly RolePermission[];
}

/** Active memberships of `userId` on `accountId` or any account above it. */
export function governingMemberships(
  ctx: AuthorityContext,
  userId: string,
  accountId: string,
): Membership[] {
  if (!ctx.tree.has(accountId)) return [];
  const chain = new Set(ctx.tree.ancestorsOf(accountId).map((a) => a.id));
  return ctx.memberships.filter(
    (m) =>
      m.userId === userId && m.status === "active" && chain.has(m.accountId),
  );
}

/** Can the user see this account's data at all? */
export function canAccessAccount(
  ctx: AuthorityContext,
  userId: string,
  accountId: string,
): boolean {
  return governingMemberships(ctx, userId, accountId).length > 0;
}

/** Does the user hold `permission` at `accountId`, via a role there or above? */
export function hasPermission(
  ctx: AuthorityContext,
  userId: string,
  accountId: string,
  permission: string,
): boolean {
  return governingMemberships(ctx, userId, accountId).some((m) => {
    const type = ctx.tree.get(m.accountId).type;
    const roles: RolePermission["role"][] = [m.role];
    if (m.isBrokerOfRecord) roles.push("broker_of_record");
    return ctx.rolePermissions.some(
      (rp) =>
        rp.accountType === type &&
        roles.includes(rp.role) &&
        rp.permission === permission,
    );
  });
}

/** The strongest role the user holds at or above `accountId`, or null. */
export function strongestRole(
  ctx: AuthorityContext,
  userId: string,
  accountId: string,
): MembershipRole | null {
  let best: MembershipRole | null = null;
  for (const m of governingMemberships(ctx, userId, accountId)) {
    if (!best || ROLE_RANK[m.role] > ROLE_RANK[best]) best = m.role;
  }
  return best;
}

/**
 * Nobody can grant a role higher than their own. The actor also needs the
 * `members.manage` capability at or above the account.
 */
export function canGrantRole(
  ctx: AuthorityContext,
  actorUserId: string,
  accountId: string,
  role: MembershipRole,
): boolean {
  if (!hasPermission(ctx, actorUserId, accountId, "members.manage"))
    return false;
  const own = strongestRole(ctx, actorUserId, accountId);
  return own !== null && ROLE_RANK[role] <= ROLE_RANK[own];
}
