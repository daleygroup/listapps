import type { InvitationPreview } from "@/lib/services/invitations";

/**
 * What the invitation accept page (`/invite/[token]`) shows, decided in one
 * pure function so every case is unit tested. The page only renders it; the
 * Server Actions re-check everything with `acceptInvitation`.
 */
export type InviteView =
  | { kind: "not-configured" }
  | { kind: "invalid" }
  | { kind: "expired"; accountName: string }
  | { kind: "used"; accountName: string }
  | {
      kind: "wrong-email";
      accountName: string;
      maskedInvitedEmail: string;
      signedInEmail: string;
    }
  | { kind: "accept"; preview: InvitationPreview }
  | { kind: "sign-in-or-create"; preview: InvitationPreview };

export function inviteView(input: {
  configured: boolean;
  preview: InvitationPreview | null;
  signedInEmail: string | null;
}): InviteView {
  if (!input.configured) return { kind: "not-configured" };
  const p = input.preview;
  if (!p) return { kind: "invalid" };
  if (p.state === "used") return { kind: "used", accountName: p.accountName };
  if (p.state === "expired") {
    return { kind: "expired", accountName: p.accountName };
  }
  if (input.signedInEmail === null) {
    return { kind: "sign-in-or-create", preview: p };
  }
  if (input.signedInEmail.toLowerCase() !== p.invitedEmail.toLowerCase()) {
    // D-008: built strict. The person must use the address it was sent to.
    return {
      kind: "wrong-email",
      accountName: p.accountName,
      maskedInvitedEmail: maskEmail(p.invitedEmail),
      signedInEmail: input.signedInEmail,
    };
  }
  return { kind: "accept", preview: p };
}

/**
 * "joseph@example.com" becomes "j*****@example.com". Enough for the right
 * person to recognise their address without spelling it out to anyone who
 * was forwarded the link.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local[0]}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

/** Plain words for a role, as shown to the person being invited. */
export function roleLabel(role: InvitationPreview["role"]): string {
  switch (role) {
    case "owner":
      return "an owner";
    case "admin":
      return "an admin";
    case "member":
      return "a member";
  }
}

/** The acknowledgement checkbox value the actions look for. */
export const ACK_VALUE = "yes";

export function parseAcknowledged(form: FormData): boolean {
  return form.get("ack") === ACK_VALUE;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

/** The token travels in a hidden field; only a plausible shape is accepted. */
export function parseInviteToken(form: FormData): string | null {
  const raw = form.get("token");
  if (typeof raw !== "string") return null;
  return TOKEN_RE.test(raw) ? raw : null;
}

/** The `[token]` route segment, or null if it cannot be a real link. */
export function tokenFromParam(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return TOKEN_RE.test(decoded) ? decoded : null;
}
