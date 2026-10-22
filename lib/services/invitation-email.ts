import type { OutgoingEmail } from "@/lib/email/mail-config";
import type { InviteRole } from "./invitations";

/**
 * The invitation email (M1-6). Pure, so the wording is tested once and the
 * sender (D-005) only has to deliver it.
 *
 * WORDING IS A DRAFT pending Joseph's answer on D-011. It is customer-facing,
 * so do not change its substance without updating that decision.
 *
 * `timeZone` is the inviting account's IANA zone (never hardcoded here);
 * falls back to UTC when missing or invalid.
 */
export interface InvitationEmailInput {
  toEmail: string;
  accountName: string;
  role: InviteRole;
  inviterName: string | null;
  /** Absolute link, built from the pinned site address only. */
  acceptUrl: string;
  expiresAt: Date;
  timeZone?: string | null;
}

const ROLE_PHRASE: Record<InviteRole, string> = {
  member: "a member",
  admin: "an admin",
  owner: "an owner",
};

function validZone(zone: string | null | undefined): string {
  if (!zone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return "UTC";
  }
}

function formatExpiry(d: Date, timeZone: string): string {
  // Day and time formatted separately so the joining word does not depend
  // on the ICU version; plain spaces because some versions use narrow ones.
  const plain = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone, ...opts })
      .format(d)
      .replace(/[\u202f\u00a0]/g, " ");
  const day = plain({ weekday: "long", month: "long", day: "numeric" });
  const time = plain({
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `${day} at ${time}`;
}

/** Names go into the subject line; never let one carry a line break. */
function oneLine(s: string): string {
  return s
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function invitationEmail(input: InvitationEmailInput): OutgoingEmail {
  const inviter = oneLine(input.inviterName ?? "") || "Someone";
  const account = oneLine(input.accountName);
  const zone = validZone(input.timeZone);
  const lines = [
    "Hi,",
    "",
    `${inviter} invited you to join ${account} on ListApps as ${ROLE_PHRASE[input.role]}.`,
    "",
    "Open this link to accept:",
    input.acceptUrl,
    "",
    `The link works once, only for this email address (${input.toEmail}), and expires ${formatExpiry(input.expiresAt, zone)}.`,
    "",
    "If this office has a policy on shared leads, you will see it before you join. Every contact you own stays yours if you ever leave.",
    "",
    "If you were not expecting this, you can ignore this email. Nobody joins anything unless you open the link and accept.",
    "",
    "ListApps",
  ];
  return {
    to: input.toEmail,
    subject: `${inviter} invited you to join ${account} on ListApps`,
    text: lines.join("\n"),
  };
}
