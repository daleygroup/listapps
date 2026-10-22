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
 * The queries also filter to one person's memberships explicitly, so a
 * platform staff member (who can read far more under RLS) still sees only
 * their own apps in the switcher.
 *
 * "View as" (impersonation): pass `viewAsUserId` to load the shell as another
 * person sees it. Every read still runs as the signed-in reader, so RLS
 * applies to them, and the load is refused unless the reader has a live
 * impersonation session on exactly that person (checked again here, inside
 * the same transaction, not only by the caller).
 *
 * Returns null when the person has no `users` row yet.
 */
export class ViewAsRefusedError extends Error {}

export async function loadShellDataSource(
  sql: Sql,
  readerId: string,
  options: { viewAsUserId?: string } = {},
): Promise<ShellDataSource | null> {
  const userId = options.viewAsUserId ?? readerId;
  return withUser(sql, readerId, async (tx) => {
    if (userId !== readerId) {
      const live = await tx`
        select 1 from public.impersonation_sessions
        where staff_user_id = ${readerId} and target_user_id = ${userId}
          and ended_at is null and expires_at > now()
          and app_private.is_staff()`;
      if (live.length === 0)
        throw new ViewAsRefusedError(
          "Viewing as another person needs a live impersonation session on them",
        );
    }
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
