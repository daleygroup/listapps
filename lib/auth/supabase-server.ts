import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authConfigFromProcess } from "./config";

/**
 * A Supabase client for Server Components, Server Actions and Route Handlers,
 * acting as the signed-in person (anon key plus their session cookie, so Row
 * Level Security applies). Returns null when auth is not configured (D-004).
 *
 * Never use the service role key here. Server-privileged work goes through
 * `lib/services/` with its own direct database connection.
 */
export async function createSupabaseServerClient() {
  const config = authConfigFromProcess();
  if (!config.configured) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. The proxy refreshes the
          // session on every request, so this is safe to ignore here.
        }
      },
    },
  });
}

export type AuthUser = { id: string; email: string };

/**
 * The verified signed-in user, or null. Uses `getUser()`, which checks the
 * token with Supabase, never the unverified cookie contents.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}
