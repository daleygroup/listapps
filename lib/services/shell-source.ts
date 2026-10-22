import {
  getShellView,
  type ShellDataSource,
  type ShellView,
} from "./app-shell";

/**
 * Decides where the app shell's data comes from. Pure, so every branch is
 * unit-tested without Supabase or a database.
 *
 * - Sign-in not set up (no D-004 settings): the sample fixture, exactly as
 *   before, so local development and CI keep working with no secrets.
 * - Sign-in set up: the signed-in person's real data, read as them. Never the
 *   fixture: a real deployment must not show sample apps to anyone.
 * - Sign-in set up and the person is ListApps staff with a live impersonation
 *   session: the impersonated person's shell (their name, office, and apps),
 *   still read as the staff member under RLS. The banner says so.
 */
export interface ShellSourceDeps {
  authConfigured: boolean;
  fixture: { source: ShellDataSource; userId: string; now: Date };
  /** The verified signed-in user, or null. */
  getUser: () => Promise<{ id: string; email: string } | null>;
  /**
   * Loads real data, read as `readerId`, for `viewAsUserId` (or the reader
   * when absent); null when no database is configured or no users row exists.
   */
  loadForUser: (
    readerId: string,
    viewAsUserId?: string,
  ) => Promise<ShellDataSource | null>;
  /** The person this signed-in user is impersonating right now, if any. */
  getViewAs?: (userId: string) => Promise<{ targetUserId: string } | null>;
  now: () => Date;
}

export const EMPTY_SHELL_VIEW: ShellView = {
  userName: "",
  accountName: null,
  apps: [],
};

export async function resolveShellView(
  deps: ShellSourceDeps,
): Promise<ShellView> {
  if (!deps.authConfigured) {
    const { source, userId, now } = deps.fixture;
    return getShellView(source, userId, now);
  }
  const user = await deps.getUser();
  // The proxy sends signed-out visitors to sign-in; this is only a backstop.
  if (!user) return EMPTY_SHELL_VIEW;
  const viewAs = deps.getViewAs ? await deps.getViewAs(user.id) : null;
  if (viewAs && viewAs.targetUserId !== user.id) {
    const source = await deps.loadForUser(user.id, viewAs.targetUserId);
    // Never fall back to the staff member's own shell mid-session: an empty
    // shell is the honest answer if the person has no data.
    if (!source) return EMPTY_SHELL_VIEW;
    return getShellView(source, viewAs.targetUserId, deps.now());
  }
  const source = await deps.loadForUser(user.id);
  if (!source) return { ...EMPTY_SHELL_VIEW, userName: user.email };
  return getShellView(source, user.id, deps.now());
}
