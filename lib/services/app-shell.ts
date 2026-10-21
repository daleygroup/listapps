import {
  AccountTree,
  entitledApplications,
  type AccountNode,
  type Membership,
  type Subscription,
} from "@/lib/resolvers";

/**
 * Data the app shell needs. Today it comes from in-memory fixtures
 * (lib/fixtures/shell-fixture.ts). Once the Milestone 1 tables are approved
 * and migrated, a database-backed source implements the same interface and
 * no component changes.
 */
export interface ApplicationInfo {
  id: string;
  slug: string;
  name: string;
  status: "available" | "coming_soon" | "hidden";
  sortOrder: number;
}

export interface ShellDataSource {
  accounts: readonly (AccountNode & { name: string })[];
  memberships: readonly Membership[];
  subscriptions: readonly Subscription[];
  applications: readonly ApplicationInfo[];
  users: readonly { id: string; fullName: string }[];
}

export interface ShellApp {
  slug: string;
  name: string;
  href: string;
}

export interface ShellView {
  userName: string;
  /** The account shown in the header: the user's first non-individual membership. */
  accountName: string | null;
  apps: ShellApp[];
}

export function getShellView(
  source: ShellDataSource,
  userId: string,
  now: Date = new Date(),
): ShellView {
  const user = source.users.find((u) => u.id === userId);
  if (!user) throw new Error(`Unknown user ${userId}`);

  const tree = new AccountTree(source.accounts);
  const visible = source.applications
    .filter((a) => a.status === "available")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const allowed = new Set(
    entitledApplications(
      {
        tree,
        memberships: source.memberships,
        subscriptions: source.subscriptions,
        now,
      },
      userId,
      visible.map((a) => a.id),
    ),
  );

  const home = source.memberships
    .filter((m) => m.userId === userId && m.status === "active")
    .map((m) => source.accounts.find((a) => a.id === m.accountId))
    .find((a) => a && a.type !== "individual");

  return {
    userName: user.fullName,
    accountName: home?.name ?? null,
    apps: visible
      .filter((a) => allowed.has(a.id))
      .map((a) => ({ slug: a.slug, name: a.name, href: `/${a.slug}` })),
  };
}
