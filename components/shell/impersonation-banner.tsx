import { connection } from "next/server";
import { getAuthUser } from "@/lib/auth/supabase-server";
import { getServerSql } from "@/lib/db/server";
import { getActiveSession } from "@/lib/services/impersonation";
import { endImpersonationAction } from "@/lib/services/impersonation-actions";
import { bannerText } from "@/lib/services/impersonation-banner";

/**
 * Shown on every shell page while a staff member has a live impersonation
 * session. There is no close button by design. Renders nothing until sign-in
 * and the database are configured (D-004).
 */
export async function ImpersonationBanner() {
  // Always decided per request. Without this the build would bake in
  // "no banner" whenever it runs without database settings.
  await connection();
  const sql = getServerSql();
  if (!sql) return null;
  const user = await getAuthUser();
  if (!user) return null;
  const session = await getActiveSession(sql, user.id);
  if (!session) return null;
  const [target] = await sql<{ name: string }[]>`
    select coalesce(full_name, email::text) as name
    from public.users where id = ${session.targetUserId}`;
  const text = bannerText({
    targetName: target?.name ?? "another person",
    mode: session.mode,
    reason: session.reason,
    expiresAt: session.expiresAt,
    now: new Date(),
  });
  return (
    <div
      role="region"
      aria-label="Viewing as another person"
      className={`flex flex-col gap-2 px-gutter py-3 text-sm text-primary-ink ${
        text.elevated ? "bg-danger" : "bg-warning"
      }`}
    >
      <p className="font-semibold">{text.headline}</p>
      <p>{text.detail}</p>
      <form action={endImpersonationAction}>
        <input type="hidden" name="sessionId" value={session.id} />
        <button
          type="submit"
          className="h-tap rounded-control bg-surface px-4 font-semibold text-ink"
        >
          End session
        </button>
      </form>
    </div>
  );
}
