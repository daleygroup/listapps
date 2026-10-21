/**
 * What a ListApps staff member may do while viewing the platform as a
 * customer (CLAUDE.md section 4, "Assume identity"). Pure rules, no database,
 * so every screen and service asks the same question the same way.
 *
 *  - Read-only by default. Writes need an elevated session (which the
 *    database only grants to staff with can_elevate_impersonation, never
 *    `sales`).
 *  - Some actions are never permitted, even elevated, even for the owner:
 *    exporting contacts, changing a password or email, changing billing,
 *    deleting anything.
 */

export type ImpersonationMode = "read_only" | "elevated";

export interface ImpersonatedAction {
  /** Dotted action name, e.g. `listing.update`, `contacts.export`. */
  name: string;
  /** True if the action changes anything. */
  writes: boolean;
}

export type ImpersonationVerdict =
  { allowed: true } | { allowed: false; reason: string };

// `writesOnly` rules forbid changes but still let support look (a plan, an
// email address). The rest are forbidden outright.
const NEVER: {
  test: (name: string) => boolean;
  reason: string;
  writesOnly?: boolean;
}[] = [
  {
    test: (n) => n === "contacts.export" || n.startsWith("contacts.export."),
    reason: "Contacts can never be exported while impersonating",
  },
  {
    test: (n) => /^(user|auth)\.(password|email)(\.|$)/.test(n),
    reason: "A password or email can never be changed while impersonating",
    writesOnly: true,
  },
  {
    test: (n) => /^(billing|subscription|subscriptions)(\.|$)/.test(n),
    reason: "Billing can never be changed while impersonating",
    writesOnly: true,
  },
  {
    test: (n) => /(^|\.)(delete|destroy|purge)$/.test(n),
    reason: "Nothing can be deleted while impersonating",
  },
];

export function checkImpersonatedAction(
  mode: ImpersonationMode,
  action: ImpersonatedAction,
): ImpersonationVerdict {
  const name = action.name.trim().toLowerCase();
  for (const rule of NEVER) {
    if (rule.test(name) && (action.writes || !rule.writesOnly))
      return { allowed: false, reason: rule.reason };
  }
  if (action.writes && mode !== "elevated") {
    return {
      allowed: false,
      reason:
        "This session is read-only. Write actions need an elevated session with a stated reason.",
    };
  }
  return { allowed: true };
}
