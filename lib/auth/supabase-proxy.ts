import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { AuthConfig } from "./config";
import { isPublicPath, signInRedirectPath } from "./routes";

/**
 * Runs in `proxy.ts` on every page request: refreshes the Supabase session
 * cookie and sends signed-out people on protected paths to the sign-in page.
 *
 * This is a convenience gate, not the security boundary. Every Server Action
 * and service re-checks the user, and RLS backs that up (CLAUDE.md section 3).
 */
export async function updateSession(
  request: NextRequest,
  config: Extract<AuthConfig, { configured: true }>,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not put code between client creation and getUser(): it is what
  // refreshes an expiring session.
  const { data } = await supabase.auth.getUser();
  const { pathname, search } = request.nextUrl;

  if (!data.user && !isPublicPath(pathname)) {
    const target = new URL(signInRedirectPath(pathname, search), request.url);
    const redirect = NextResponse.redirect(target);
    // Carry over any cookie changes (for example a cleared expired session).
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }
  return response;
}
