"use server";

import { revalidatePath } from "next/cache";
import type { FormResult } from "@/lib/auth/forms";
import { getAuthUser } from "@/lib/auth/supabase-server";
import { getServerSql } from "@/lib/db/server";
import {
  emailLinkOrigin,
  mailEnvFromProcess,
  mailerFromEnv,
  SITE_URL_MISSING,
} from "@/lib/email/mail-config";
import { invitationEmail } from "./invitation-email";
import { inviteSentNotice, parseInviteForm } from "./invite-form";
import {
  createInvitation,
  invitationEmailContext,
  InvitationError,
  resendInvitation,
  revokeInvitation,
  type CreatedInvitation,
} from "./invitations";

/**
 * Settings > People: invite, resend, withdraw. Who is acting comes only from
 * the verified session; the services re-check permission and Row Level
 * Security enforces it again. The raw link token lives only in memory here,
 * goes into the email, and is dropped. It is never shown on screen (that
 * would be D-009) and never logged.
 */
type ActionResult = FormResult;

const NOT_SET_UP: ActionResult = {
  error: "Sign-in is not set up yet on this copy of ListApps.",
};

function field(form: FormData, name: string): string | null {
  const v = form.get(name);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function actor() {
  const sql = getServerSql();
  const user = sql ? await getAuthUser() : null;
  return sql && user ? { sql, userId: user.id } : null;
}

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    const notice = await fn();
    revalidatePath("/settings");
    return { notice };
  } catch (err) {
    if (err instanceof InvitationError) return { error: err.message };
    throw err;
  }
}

/** Build and try to send the email for a fresh link. Returns whether it went. */
async function deliver(
  a: { sql: NonNullable<ReturnType<typeof getServerSql>>; userId: string },
  created: CreatedInvitation,
): Promise<{ sent: boolean; reason?: string }> {
  const env = mailEnvFromProcess();
  const origin = emailLinkOrigin(env);
  const mailer = mailerFromEnv(env);
  const ctx = await invitationEmailContext(a.sql, {
    membershipId: created.membershipId,
    actorUserId: a.userId,
  });
  if (!origin) return { sent: false, reason: SITE_URL_MISSING };
  if (!ctx) {
    return { sent: false, reason: "The invitation could not be read back." };
  }
  const result = await mailer.send(
    invitationEmail({
      toEmail: created.email,
      accountName: ctx.accountName,
      role: ctx.role,
      inviterName: ctx.inviterName,
      acceptUrl: `${origin}${created.acceptPath}`,
      expiresAt: created.expiresAt,
      timeZone: ctx.accountTimeZone,
    }),
  );
  return result.sent ? { sent: true } : { sent: false, reason: result.reason };
}

export async function inviteMemberAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const a = await actor();
  if (!a) return NOT_SET_UP;
  const parsed = parseInviteForm(form);
  if (!parsed.ok) return { error: parsed.error };
  return run(async () => {
    const created = await createInvitation(a.sql, {
      accountId: parsed.accountId,
      email: parsed.email,
      role: parsed.role,
      actorUserId: a.userId,
    });
    return inviteSentNotice(created.email, await deliver(a, created), "new");
  });
}

export async function resendInviteAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const a = await actor();
  if (!a) return NOT_SET_UP;
  const membershipId = field(form, "membershipId");
  if (!membershipId) return { error: "Choose an invitation to resend." };
  return run(async () => {
    const created = await resendInvitation(a.sql, {
      membershipId,
      actorUserId: a.userId,
    });
    return inviteSentNotice(created.email, await deliver(a, created), "resend");
  });
}

export async function withdrawInviteAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const a = await actor();
  if (!a) return NOT_SET_UP;
  const membershipId = field(form, "membershipId");
  if (!membershipId) return { error: "Choose an invitation to withdraw." };
  return run(async () => {
    await revokeInvitation(a.sql, {
      membershipId,
      actorUserId: a.userId,
    });
    return "Invitation withdrawn. The link no longer works.";
  });
}
