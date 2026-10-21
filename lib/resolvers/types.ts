/**
 * Plain data shapes the resolvers work on. They mirror the Milestone 1 tables
 * proposed in docs/proposals/001-milestone-1-schema.md, but carry only the
 * fields the resolvers need, so they work the same against fixtures, a
 * database query, or a cache.
 */

export type AccountType =
  | "platform"
  | "corporate"
  | "organization"
  | "brokerage"
  | "team"
  | "individual";

export interface AccountNode {
  id: string;
  parentId: string | null;
  type: AccountType;
}

export type MembershipRole = "owner" | "admin" | "member";
export type MembershipStatus = "invited" | "active" | "removed";

export interface Membership {
  accountId: string;
  userId: string;
  role: MembershipRole;
  isBrokerOfRecord: boolean;
  status: MembershipStatus;
}

/** A row of role_permissions. `broker_of_record` rows apply to flagged members. */
export interface RolePermission {
  accountType: AccountType;
  role: MembershipRole | "broker_of_record";
  permission: string;
}

export type SubscriptionStatus =
  "trialing" | "active" | "past_due" | "lapsed" | "canceled";

export interface Subscription {
  id: string;
  accountId: string;
  applicationId: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  includesDescendants: boolean;
  seatLimit: number | null;
  seatsUsed: number;
}
