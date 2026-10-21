"use server";

import { redirect } from "next/navigation";
import { getServerSql } from "@/lib/db/server";
import {
  acceptInvitation,
  InvitationError,
  previewInvitation,
} from "@/lib/services/invitations";
import { parseNewPassword, type FormResult } from "./forms";
import { parseAcknowledged, parseInviteToken } from "./invite-view";
import { DEFAULT_AFTER_SIGN_IN } from "./routes";
import { createSupabaseAdminClient } from "./supabase-admin";
import { createSupabaseServerClient, getAuthUser } from "./supabase-server";

const NOT_CONFIGURED: FormResult = {
  error: "Invitations are not set up yet on this copy of ListApps.",
};
const BAD_LINK: FormResult = {
  error: "This invitation link is not valid or was already used.",
};
const ACK_NEEDED: FormResult = {
  error:
    "Please read and tick the box about how this account handles contacts before joining.",
};

/**
 * A signed-in person accepts. Who they are comes only from the verified
 * session; the service re-checks the token, expiry, email match (D-008) and
 * the contact policy acknowledgement.
 */
export async function acceptInviteAction(
  _prev: FormResult,
  form: FormData,
): Promise<FormResult> {
  const sql = getServerSql();
  if (!sql) return NOT_CONFIGURED;
  const token = parseInviteToken(form);
  if (!token) return BAD_LINK;
  const user = await getAuthUser();
  if (!user) return { error: "Sign in first, then accept." };
  try {
    await acceptInvitation(sql, {
      token,
      userId: user.id,
      contactPolicyAcknowledged: parseAcknowledged(form),
    });
  } catch (err) {
    if (err instanceof InvitationError) return { error: err.message };
    throw err;
  }
  redirect(DEFAULT_AFTER_SIGN_IN);
}

/**
 * A new person sets a password and joins in one step. Public sign-up is off,
 * so the account is created here with the address the invitation was sent
 * to (holding the emailed link proves they own it), never one they type.
 */
export async function createAccountAndAcceptAction(
  _prev: FormResult,
  form: FormData,
): Promise<FormResult> {
  const sql = getServerSql();
  const admin = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();
  if (!sql || !admin || !supabase) return NOT_CONFIGURED;

  const token = parseInviteToken(form);
  if (!token) return BAD_LINK;
  const preview = await previewInvitation(sql, { token });
  if (!preview || preview.state === "used") return BAD_LINK;
  if (preview.state === "expired") {
    return { error: "This invitation has expired; ask for a new one." };
  }
  const acknowledged = parseAcknowledged(form);
  // Check before creating anything, so a missed tick never leaves a stray
  // account behind.
  if (preview.contactRetentionPolicy && !acknowledged) return ACK_NEEDED;
  const password = parseNewPassword(form);
  if (!password.ok) return { error: password.error };

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: preview.invitedEmail,
      password: password.password,
      email_confirm: true,
    });
  if (createError || !created.user) {
    return {
      error:
        "There is already a ListApps sign-in for this address. Sign in instead, then come back to this link.",
    };
  }
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: preview.invitedEmail,
    password: password.password,
  });
  if (signInError) {
    return {
      error:
        "Your sign-in was created but we could not sign you in. Try signing in.",
    };
  }
  try {
    await acceptInvitation(sql, {
      token,
      userId: created.user.id,
      contactPolicyAcknowledged: acknowledged,
    });
  } catch (err) {
    if (err instanceof InvitationError) return { error: err.message };
    throw err;
  }
  redirect(DEFAULT_AFTER_SIGN_IN);
}
