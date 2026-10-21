/**
 * Which paths need a signed-in user, and where to send people afterwards.
 * Pure functions so the proxy, the pages, and the tests share one answer.
 */

export const SIGN_IN_PATH = "/sign-in";
export const DEFAULT_AFTER_SIGN_IN = "/settings";

/** Paths anyone may open without signing in. Everything else is protected. */
const PUBLIC_PREFIXES = [
  "/sign-in",
  "/forgot-password",
  "/reset-password", // the recovery link signs the person in first
  "/auth/", // callback and sign-out route handlers
  "/invite/", // the accept page shows a preview before sign-in (M1-6)
];

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((prefix) =>
    prefix.endsWith("/")
      ? pathname.startsWith(prefix)
      : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Only same-site relative paths are allowed as a post-sign-in destination.
 * Anything else (another host, a protocol-relative URL, backslash tricks,
 * control characters) falls back to the default. Prevents open redirects.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_AFTER_SIGN_IN;
  if (raw.length > 512) return DEFAULT_AFTER_SIGN_IN;
  if (!raw.startsWith("/")) return DEFAULT_AFTER_SIGN_IN;
  if (raw.startsWith("//") || raw.includes("\\")) return DEFAULT_AFTER_SIGN_IN;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_AFTER_SIGN_IN;
  let url: URL;
  try {
    url = new URL(raw, "https://listapps.invalid");
  } catch {
    return DEFAULT_AFTER_SIGN_IN;
  }
  if (url.origin !== "https://listapps.invalid") return DEFAULT_AFTER_SIGN_IN;
  // Never bounce back into the sign-in pages themselves.
  if (url.pathname === SIGN_IN_PATH || url.pathname.startsWith("/auth/")) {
    return DEFAULT_AFTER_SIGN_IN;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The sign-in URL for someone who tried to open `pathname` signed out. */
export function signInRedirectPath(pathname: string, search = ""): string {
  const next = safeNextPath(`${pathname}${search}`);
  if (next === DEFAULT_AFTER_SIGN_IN) return SIGN_IN_PATH;
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`;
}
