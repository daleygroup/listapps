"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";
import {
  parseEmail,
  parseNewPassword,
  parseSignIn,
  RESET_SENT,
  SIGN_IN_FAILED,
  type FormResult,
} from "./forms";
import { safeNextPath, SIGN_IN_PATH } from "./routes";

const NOT_CONFIGURED: FormResult = {
  error: "Sign-in is not set up yet on this copy of ListApps.",
};

/**
 * The site origin for links Supabase emails or redirects to. Supabase only
 * honours redirect URLs on the project's allow list, so a forged Host header
 * cannot send people elsewhere; LISTAPPS_SITE_URL pins it when set.
 */
async function siteOrigin(): Promise<string> {
  const pinned = process.env.LISTAPPS_SITE_URL;
  if (pinned) return new URL(pinned).origin;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signInWithPassword(
  _prev: FormResult,
  form: FormData,
): Promise<FormResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  const parsed = parseSignIn(form);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });
  if (error) return { error: SIGN_IN_FAILED };
  redirect(safeNextPath(form.get("next")?.toString()));
}

export async function signInWithGoogle(form: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(SIGN_IN_PATH);
  const next = safeNextPath(form.get("next")?.toString());
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    // Basic scope only (email, profile). Gmail scopes are out of scope until
    // Joseph funds the CASA assessment (CLAUDE.md section 12b).
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) redirect(`${SIGN_IN_PATH}?error=google`);
  redirect(data.url);
}

export async function requestPasswordReset(
  _prev: FormResult,
  form: FormData,
): Promise<FormResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  const email = parseEmail(form);
  if (!email) return { error: "Enter the email you sign in with." };
  const origin = await siteOrigin();
  // The result is ignored on purpose: the same answer whether or not the
  // address has an account, so the form cannot be used to find accounts.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });
  return { notice: RESET_SENT };
}

export async function setNewPassword(
  _prev: FormResult,
  form: FormData,
): Promise<FormResult> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NOT_CONFIGURED;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      error: "Your reset link has expired. Request a new one.",
    };
  }
  const parsed = parseNewPassword(form);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await supabase.auth.updateUser({
    password: parsed.password,
  });
  if (error) return { error: "That password could not be saved. Try another." };
  redirect(safeNextPath(null));
}
