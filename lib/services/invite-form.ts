import { DEFAULT_INVITE_TTL_HOURS, type InviteRole } from "./invitations";

/**
 * Parsing and wording for the "Invite someone" form. Pure, unit-tested.
 * The account id from the form is only a choice of where to invite; the
 * service decides under Row Level Security whether the inviter may.
 */
export type ParsedInvite =
  | { ok: true; accountId: string; email: string; role: InviteRole }
  | { ok: false; error: string };

const ROLES: readonly InviteRole[] = ["member", "admin", "owner"];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function parseInviteForm(form: FormData): ParsedInvite {
  const accountId = text(form, "accountId");
  if (!UUID_RE.test(accountId)) {
    return { ok: false, error: "Choose where to invite them." };
  }
  const email = text(form, "email").toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: "Enter their email address." };
  }
  const role = text(form, "role") || "member";
  if (!(ROLES as readonly string[]).includes(role)) {
    return { ok: false, error: "Choose a role." };
  }
  return { ok: true, accountId, email, role: role as InviteRole };
}

/** What the inviter sees after inviting or resending. */
export function inviteSentNotice(
  email: string,
  delivery: { sent: boolean; reason?: string },
  kind: "new" | "resend",
): string {
  if (delivery.sent) {
    return kind === "new"
      ? `Invitation emailed to ${email}. The link lasts ${DEFAULT_INVITE_TTL_HOURS / 24} days.`
      : `A fresh link was emailed to ${email}. The old link no longer works.`;
  }
  const why = delivery.reason ? ` ${delivery.reason}` : "";
  return kind === "new"
    ? `Invitation saved for ${email}, but no email was sent.${why} Use Resend once email is set up.`
    : `A fresh link was made for ${email}, but no email was sent.${why} The old link no longer works.`;
}
