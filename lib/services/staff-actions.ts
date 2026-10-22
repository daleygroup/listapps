"use server";

import { redirect } from "next/navigation";
import type { FormResult } from "@/lib/auth/forms";
import { getAuthUser } from "@/lib/auth/supabase-server";
import { getServerSql } from "@/lib/db/server";
import { ImpersonationError } from "./impersonation";
import { startImpersonationByEmail } from "./staff-tools";

/**
 * Staff start a read-only "view as" session. The staff member comes only from
 * the verified session; the service re-checks staff status and logs the start.
 */
export async function startImpersonationAction(
  _prev: FormResult,
  form: FormData,
): Promise<FormResult> {
  const sql = getServerSql();
  const user = sql ? await getAuthUser() : null;
  if (!sql || !user) {
    return { error: "Sign-in is not set up yet on this copy of ListApps." };
  }
  const text = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : "";
  };
  const minutes = Number.parseInt(text("minutes"), 10);
  try {
    await startImpersonationByEmail(sql, {
      staffUserId: user.id,
      email: text("email"),
      reason: text("reason"),
      minutes: Number.isFinite(minutes) ? minutes : undefined,
    });
  } catch (err) {
    if (err instanceof ImpersonationError) return { error: err.message };
    throw err;
  }
  redirect("/settings");
}
