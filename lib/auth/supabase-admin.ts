import "server-only";
import { createClient } from "@supabase/supabase-js";
import { authConfigFromProcess } from "./config";

/**
 * Supabase admin client, used for exactly one thing: creating the sign-in
 * for a person who opened a valid invitation link and has no account yet.
 * Public sign-up stays off (docs/AUTH-SETUP.md), so this is the only way a
 * new person gets in, and only with the address the invitation was sent to.
 *
 * The key is read from SUPABASE_SERVICE_ROLE_KEY, a server-only variable.
 * It never has a NEXT_PUBLIC_ name (config.ts refuses to start if it does).
 * Returns null when either the project or the key is missing.
 */
export function createSupabaseAdminClient() {
  const config = authConfigFromProcess();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config.configured || !key) return null;
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
