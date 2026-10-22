import { connection } from "next/server";
import { getAuthUser } from "@/lib/auth/supabase-server";
import { getServerSql } from "@/lib/db/server";
import { getActiveSession } from "@/lib/services/impersonation";
import { getStaffMember } from "@/lib/services/staff-tools";
import { StartImpersonationForm } from "./start-impersonation-form";

/**
 * ListApps staff only. Customers (at any level of the tree) see a plain
 * "not available" line and nothing else. Shows nothing until D-004.
 */
export async function StaffSection() {
  await connection();
  const sql = getServerSql();
  const user = sql ? await getAuthUser() : null;
  if (!sql || !user) {
    return (
      <p className="text-ink-muted">
        Staff tools will appear here once sign-in is set up.
      </p>
    );
  }
  const staff = await getStaffMember(sql, user.id);
  if (!staff) {
    return <p className="text-ink-muted">This page is for ListApps staff.</p>;
  }
  if (await getActiveSession(sql, user.id)) {
    return (
      <p className="text-ink-muted">
        You already have a session open. End it from the banner at the top of
        the page before starting another.
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">View as a customer</h2>
      <p className="text-sm text-ink-muted">
        Sessions start view-only, show a banner the whole time, are logged step
        by step, and the person is emailed afterwards with who looked and when.
        Exporting contacts, changing passwords, email or billing, and deleting
        anything are never allowed.
      </p>
      <StartImpersonationForm />
    </section>
  );
}
