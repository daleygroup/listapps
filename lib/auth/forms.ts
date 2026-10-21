/**
 * Pure form parsing for the sign-in pages, so validation is tested once and
 * the Server Actions stay thin. Messages never reveal whether an email
 * address has an account.
 */

export type FormResult = { error?: string; notice?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

function field(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
}

export function parseEmail(form: FormData): string | null {
  const email = field(form, "email").trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 320 ? email : null;
}

export function parseSignIn(
  form: FormData,
):
  { ok: true; email: string; password: string } | { ok: false; error: string } {
  const email = parseEmail(form);
  const password = field(form, "password");
  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }
  return { ok: true, email, password };
}

export function parseNewPassword(
  form: FormData,
): { ok: true; password: string } | { ok: false; error: string } {
  const password = field(form, "password");
  const confirm = field(form, "confirm");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password.length > 72) {
    // Supabase (bcrypt) ignores anything past 72 bytes.
    return { ok: false, error: "Use 72 characters or fewer." };
  }
  if (password !== confirm) {
    return { ok: false, error: "The two passwords do not match." };
  }
  return { ok: true, password };
}

export const SIGN_IN_FAILED = "That email and password did not match.";
export const RESET_SENT =
  "If that email has a ListApps account, a reset link is on its way.";

/** Messages for `?error=` codes the callback route can send back. */
export function callbackErrorMessage(code: string | null): string | null {
  switch (code) {
    case "link":
      return "That link has expired or was already used. Request a new one.";
    case "google":
      return "Google sign-in did not finish. Try again.";
    default:
      return null;
  }
}
