import { AccountTree } from "./tree";
import type { Membership, Subscription, SubscriptionStatus } from "./types";

/**
 * App access (CLAUDE.md section 4, Entitlements). A user can use an app if a
 * subscription to it is in good standing on:
 *   - an account they are an active member of (this includes their own
 *     `individual` account), or
 *   - any account above one of those, when `includesDescendants` is on,
 * and the subscription has a free seat (or the user already holds one).
 *
 * The direct-membership case is clarification Q3 in proposal 001 (D-003).
 * When subscriptions only exist in a lapsed state the result is read-only:
 * data is never deleted and stays readable and exportable.
 */

export type AccessLevel = "full" | "read_only" | "none";

const GOOD_STANDING: readonly SubscriptionStatus[] = ["active", "trialing"];

export interface EntitlementContext {
  tree: AccountTree;
  memberships: readonly Membership[];
  subscriptions: readonly Subscription[];
  /** Whether the user already holds one of this subscription's seats. */
  holdsSeat?: (subscription: Subscription, userId: string) => boolean;
  now?: Date;
}

function inGoodStanding(s: Subscription, now: Date): boolean {
  if (!GOOD_STANDING.includes(s.status)) return false;
  if (s.status === "trialing" && s.trialEndsAt && s.trialEndsAt <= now) {
    return false;
  }
  return true;
}

function hasSeatFor(
  ctx: EntitlementContext,
  s: Subscription,
  userId: string,
): boolean {
  if (s.seatLimit === null) return true;
  if (ctx.holdsSeat?.(s, userId)) return true;
  return s.seatsUsed < s.seatLimit;
}

/** Subscriptions to `applicationId` that reach this user, good standing or not. */
export function coveringSubscriptions(
  ctx: EntitlementContext,
  userId: string,
  applicationId: string,
): Subscription[] {
  const memberAccounts = ctx.memberships
    .filter(
      (m) =>
        m.userId === userId &&
        m.status === "active" &&
        ctx.tree.has(m.accountId),
    )
    .map((m) => m.accountId);

  const found = new Map<string, Subscription>();
  for (const accountId of memberAccounts) {
    const chain = ctx.tree.ancestorsOf(accountId);
    chain.forEach((node, depth) => {
      for (const s of ctx.subscriptions) {
        if (s.accountId !== node.id || s.applicationId !== applicationId)
          continue;
        const reaches = depth === 0 || s.includesDescendants;
        if (reaches) found.set(s.id, s);
      }
    });
  }
  return [...found.values()];
}

export function appAccess(
  ctx: EntitlementContext,
  userId: string,
  applicationId: string,
): AccessLevel {
  const now = ctx.now ?? new Date();
  const subs = coveringSubscriptions(ctx, userId, applicationId);
  if (subs.some((s) => inGoodStanding(s, now) && hasSeatFor(ctx, s, userId))) {
    return "full";
  }
  return subs.length > 0 ? "read_only" : "none";
}

/** Every application id the user can fully use. Drives the app switcher. */
export function entitledApplications(
  ctx: EntitlementContext,
  userId: string,
  applicationIds: readonly string[],
): string[] {
  return applicationIds.filter((id) => appAccess(ctx, userId, id) === "full");
}
