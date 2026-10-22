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
 */
export interface ShellSourceDeps {
  authConfigured: boolean;
  fixture: { source: ShellDataSource; userId: string; now: Date };
  /** The verified signed-in user, or null. */
  getUser: () => Promise<{ id: string; email: string } | null>;
  /** Loads real data for the user; null when no database is configured or no users row exists. */
  loadForUser: (userId: string) => Promise<ShellDataSource | null>;
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
  const source = await deps.loadForUser(user.id);
  if (!source) return { ...EMPTY_SHELL_VIEW, userName: user.email };
  return getShellView(source, user.id, deps.now());
}
