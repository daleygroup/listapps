/**
 * Supabase Auth configuration, read from the environment.
 *
 * Until Joseph creates the `listapps-development` project (D-004), these
 * variables are absent and the app runs in "not configured" mode: the shell
 * keeps using fixture data and the sign-in page says sign-in is not set up.
 *
 * Only the URL and the anon (publishable) key are ever exposed to the
 * browser. The service role key is server-only and never read here
 * (CLAUDE.md section 3).
 */
export type AuthConfig =
  | { configured: false; reason: string }
  | { configured: true; url: string; anonKey: string };

type Env = Record<string, string | undefined>;

export function readAuthConfig(env: Env): AuthConfig {
  // A service role key under a NEXT_PUBLIC_ name would be bundled into the
  // browser. Refuse to run rather than leak it.
  for (const [name, value] of Object.entries(env)) {
    if (
      name.startsWith("NEXT_PUBLIC_") &&
      /SERVICE_ROLE|SECRET/i.test(name) &&
      value
    ) {
      throw new Error(
        `${name} must never be public. Rename it without NEXT_PUBLIC_.`,
      );
    }
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return {
      configured: false,
      reason:
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (D-004).",
    };
  }
  if (/production/i.test(url)) {
    // Development and production are separate projects (CLAUDE.md section 11);
    // a production URL here in a dev or CI build is a mistake worth stopping.
    if (env.LISTAPPS_ALLOW_PRODUCTION_AUTH !== "yes") {
      throw new Error(
        "Refusing to use a production Supabase project without LISTAPPS_ALLOW_PRODUCTION_AUTH=yes.",
      );
    }
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use https.");
  }
  return { configured: true, url: parsed.origin, anonKey };
}

/**
 * Next.js only inlines NEXT_PUBLIC_ variables that are referenced literally,
 * so the app reads them through this function rather than passing
 * `process.env` around.
 */
export function authConfigFromProcess(): AuthConfig {
  return readAuthConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
    LISTAPPS_ALLOW_PRODUCTION_AUTH: process.env.LISTAPPS_ALLOW_PRODUCTION_AUTH,
  });
}
