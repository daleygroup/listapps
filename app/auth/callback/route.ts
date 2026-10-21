import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { safeNextPath, SIGN_IN_PATH } from "@/lib/auth/routes";

/**
 * Where Google sign-in and password-reset emails land. Swaps the one-time
 * code for a session cookie, then continues to a same-site page only.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const isGoogle = !next.startsWith("/reset-password");
  const failed = new URL(
    `${SIGN_IN_PATH}?error=${isGoogle ? "google" : "link"}`,
    request.url,
  );

  const supabase = await createSupabaseServerClient();
  if (!supabase || !code) return NextResponse.redirect(failed);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(failed);
  return NextResponse.redirect(new URL(next, request.url));
}
