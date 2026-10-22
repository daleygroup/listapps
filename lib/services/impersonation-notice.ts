import type { QueuedNotice } from "./impersonation";

/**
 * The email a person receives after ListApps staff viewed their account
 * (CLAUDE.md section 4: "The impersonated user is emailed afterward ... This
 * is not optional"). Pure, so the wording is tested once and the sender
 * (D-005) only has to deliver it.
 *
 * WORDING IS A DRAFT pending Joseph's answer on D-010. It is customer-facing,
 * so do not change its substance without updating that decision.
 *
 * `timeZone` is an IANA name resolved by the caller from the person's account
 * (never hardcoded here). Falls back to UTC when it is missing or invalid.
 */
export interface NoticeEmail {
  subject: string;
  text: string;
}

function validZone(zone: string | null | undefined): string {
  if (!zone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return "UTC";
  }
}

function formatWhen(start: Date, end: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  // Some ICU versions put narrow no-break spaces before AM/PM; plain email
  // clients render those badly, so use ordinary spaces.
  const plain = (f: Intl.DateTimeFormat, d: Date) =>
    f.format(d).replace(/[\u202f\u00a0]/g, " ");
  const sameDay = plain(day, start) === plain(day, end);
  return sameDay
    ? `on ${plain(day, start)}, from ${plain(time, start)} to ${plain(time, end)}`
    : `from ${plain(day, start)} at ${plain(time, start)} to ${plain(day, end)} at ${plain(time, end)}`;
}

export function impersonationNoticeEmail(
  notice: QueuedNotice,
  options: { timeZone?: string | null } = {},
): NoticeEmail {
  const zone = validZone(options.timeZone);
  const greeting = notice.toName?.trim()
    ? `Hi ${notice.toName.trim()},`
    : "Hi,";
  const elevated = notice.elevatedReason !== null;
  const actions =
    notice.actionCount === 0
      ? "No actions were logged beyond opening your account."
      : `${notice.actionCount} action${notice.actionCount === 1 ? " was" : "s were"} logged during the session.`;

  const lines = [
    greeting,
    "",
    `${notice.staffName} from ListApps support viewed your ListApps account ${formatWhen(notice.startedAt, notice.endedAt, zone)}.`,
    "",
    `Reason given: ${notice.reason}`,
    "",
    elevated
      ? `For part of this session they were allowed to make changes. Reason given for that: ${notice.elevatedReason}. Every change is recorded.`
      : "This was view only. Nothing in your account could be changed.",
    actions,
    "",
    "ListApps staff can never export your contacts, change your password or email address, change your billing, or delete anything in your account.",
    "",
    "If you did not expect this, contact ListApps support and we will walk you through exactly what was viewed.",
    "",
    "ListApps",
  ];

  return {
    subject: elevated
      ? "ListApps support viewed and was allowed to change your account"
      : "ListApps support viewed your account",
    text: lines.join("\n"),
  };
}
