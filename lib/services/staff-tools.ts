import type { Sql } from "postgres";
import { withUser } from "@/lib/db/session";
import {
  ImpersonationError,
  startImpersonation,
  type ImpersonationSession,
} from "./impersonation";

/**
 * The staff "view as" start screen. Staff type the exact email address of the
 * person a support request is about; there is deliberately no browsable list
 * of customers. Everything is read as the staff member, so Row Level Security
 * applies, and `startImpersonation` re-checks staff status, refuses staff
 * targets, logs the start, and limits the length.
 */
export interface StaffMember {
  staffRole: string;
  canElevate: boolean;
}

/** The signed-in person's active staff record, or null for every customer. */
export async function getStaffMember(
  sql: Sql,
  userId: string,
): Promise<StaffMember | null> {
  return withUser(sql, userId, async (tx) => {
    const [row] = await tx<StaffMember[]>`
      select staff_role as "staffRole", can_elevate_impersonation as "canElevate"
      from public.platform_staff
      where user_id = ${userId} and active`;
    return row ?? null;
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function startImpersonationByEmail(
  sql: Sql,
  input: {
    staffUserId: string;
    email: string;
    reason: string;
    minutes?: number;
  },
): Promise<ImpersonationSession> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email))
    throw new ImpersonationError("Enter the person's full email address");
  const target = await withUser(sql, input.staffUserId, async (tx) => {
    const [{ staff }] = await tx<{ staff: boolean }[]>`
      select app_private.is_staff() as staff`;
    if (!staff)
      throw new ImpersonationError(
        "Only ListApps staff can impersonate anyone",
      );
    const [row] = await tx<{ id: string }[]>`
      select id from public.users where email = ${email}`;
    return row ?? null;
  });
  if (!target)
    throw new ImpersonationError(
      "Nobody with that email address uses ListApps",
    );
  return startImpersonation(sql, {
    staffUserId: input.staffUserId,
    targetUserId: target.id,
    reason: input.reason,
    minutes: input.minutes,
  });
}
