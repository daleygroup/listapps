import type { Sql } from "postgres";
import type {
  AccountType,
  MembershipRole,
  MembershipStatus,
  SubscriptionStatus,
} from "@/lib/resolvers";
import { withUser } from "@/lib/db/session";
import type { ShellDataSource } from "./app-shell";

/**
 * Loads everything the app shell needs for one signed-in person, from the
 * database, as that person (Row Level Security applies to every read).
 *
 * The queries also filter to the person's own memberships explicitly, so a
 * platform staff member (who can read far more under RLS) still sees only
 * their own apps in the switcher. Seeing through someone else's eyes is the
 * impersonation feature's job, never the shell's.
 *
 * Returns null when the person has no `users` row yet.
 */
export async function loadShellDataSource(
  sql: Sql,
  userId: string,
): Promise<ShellDataSource | null> {
  return withUser(sql, userId, async (tx) => {
    const users = await tx<{ id: string; fullName: string }[]>`
      select id, coalesce(nullif(full_name, ''), email::text) as "fullName"
      from public.users where id = ${userId}`;
    if (users.length === 0) return null;

    const memberships = await tx<
      {
        accountId: string;
        userId: string;
        role: MembershipRole;
        isBrokerOfRecord: boolean;
        status: MembershipStatus;
      }[]
    >`
      select account_id as "accountId", user_id as "userId", role,
             is_broker_of_record as "isBrokerOfRecord", status
      from public.account_memberships
      where user_id = ${userId} and status = 'active'`;

    // Every account the person actively belongs to, plus everything above
    // each one (ancestor subscriptions can flow down to them).
    const accounts = await tx<
      { id: string; parentId: string | null; type: AccountType; name: string }[]
    >`
      select distinct a.id, a.parent_account_id as "parentId",
             a.account_type as type, a.name
      from public.accounts a
      join public.account_memberships m
        on a.path operator(extensions.@>) m.account_path
      where m.user_id = ${userId} and m.status = 'active'`;

    const subscriptions = await tx<
      {
        id: string;
        accountId: string;
        applicationId: string;
        status: SubscriptionStatus;
        trialEndsAt: Date | null;
        includesDescendants: boolean;
        seatLimit: number | null;
        seatsUsed: number;
      }[]
    >`
      select distinct s.id, s.account_id as "accountId",
             s.application_id as "applicationId", s.status,
             s.trial_ends_at as "trialEndsAt",
             s.includes_descendants as "includesDescendants",
             s.seat_limit as "seatLimit", s.seats_used as "seatsUsed"
      from public.subscriptions s
      join public.account_memberships m
        on s.account_path operator(extensions.@>) m.account_path
      where m.user_id = ${userId} and m.status = 'active'`;

    const applications = await tx<
      {
        id: string;
        slug: string;
        name: string;
        status: "available" | "coming_soon" | "hidden";
        sortOrder: number;
      }[]
    >`
      select id, slug, name, status, sort_order as "sortOrder"
      from public.applications`;

    return {
      users: [...users],
      accounts: [...accounts],
      memberships: [...memberships],
      subscriptions: [...subscriptions],
      applications: [...applications],
    };
  });
}
