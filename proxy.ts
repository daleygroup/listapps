import { NextResponse, type NextRequest } from "next/server";
import { authConfigFromProcess } from "@/lib/auth/config";
import { updateSession } from "@/lib/auth/supabase-proxy";

export async function proxy(request: NextRequest) {
  const config = authConfigFromProcess();
  // Until D-004 supplies a Supabase project, the app runs on fixture data
  // with no sign-in, exactly as before.
  if (!config.configured) return NextResponse.next();
  return updateSession(request, config);
}

export const config = {
  matcher: [
    // Every page, but not static files, images, or the favicon.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
