import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { SIGN_IN_PATH } from "@/lib/auth/routes";

/** POST only, so a link or image on another site cannot sign someone out. */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url), {
    status: 303,
  });
}
