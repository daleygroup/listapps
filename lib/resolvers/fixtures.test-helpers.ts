import { AccountTree } from "./tree";
import type { AccountNode, Membership, RolePermission } from "./types";

/**
 * Generic test tree (no real customer names; those live only in seed files):
 *
 *   org-1 (organization)
 *   ├── brk-a (brokerage)
 *   │   ├── team-a1 (team)
 *   │   └── team-a2 (team)
 *   └── brk-b (brokerage)
 *   brk-x (brokerage, unrelated top-level)
 *   ind-alice, ind-bob (individual, top-level)
 */
export const ACCOUNTS: AccountNode[] = [
  { id: "org-1", parentId: null, type: "organization" },
  { id: "brk-a", parentId: "org-1", type: "brokerage" },
  { id: "team-a1", parentId: "brk-a", type: "team" },
  { id: "team-a2", parentId: "brk-a", type: "team" },
  { id: "brk-b", parentId: "org-1", type: "brokerage" },
  { id: "brk-x", parentId: null, type: "brokerage" },
  { id: "ind-alice", parentId: null, type: "individual" },
  { id: "ind-bob", parentId: null, type: "individual" },
];

export const tree = () => new AccountTree(ACCOUNTS);

export function member(
  userId: string,
  accountId: string,
  role: Membership["role"] = "member",
  extra: Partial<Membership> = {},
): Membership {
  return {
    userId,
    accountId,
    role,
    isBrokerOfRecord: false,
    status: "active",
    ...extra,
  };
}

export const ROLE_PERMISSIONS: RolePermission[] = [
  ...(["brokerage", "team", "organization"] as const).flatMap((t) =>
    (["owner", "admin"] as const).flatMap((role) =>
      ["members.invite", "members.manage", "account.update"].map(
        (permission) => ({ accountType: t, role, permission }),
      ),
    ),
  ),
  { accountType: "brokerage", role: "owner", permission: "listing.reassign" },
  { accountType: "brokerage", role: "admin", permission: "listing.reassign" },
  {
    accountType: "brokerage",
    role: "broker_of_record",
    permission: "compliance.review",
  },
];
