"use server";

import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/supabase-server";
import { getServerSql } from "@/lib/db/server";
import { endImpersonation, ImpersonationError } from "./impersonation";

/**
 * "End session" on the banner. The staff member comes only from the verified
 * session; the service checks the session is theirs and still open, ends it,
 * and queues the notice to the person who was viewed.
 */
export async function endImpersonationAction(form: FormData): Promise<void> {
  const sql = getServerSql();
  const user = await getAuthUser();
  const sessionId = form.get("sessionId");
  if (!sql || !user || typeof sessionId !== "string") redirect("/");
  try {
    await endImpersonation(sql, { sessionId, staffUserId: user.id });
  } catch (err) {
    // Already ended or expired: the banner disappears on reload either way.
    if (!(err instanceof ImpersonationError)) throw err;
  }
  redirect("/settings");
}
