import { connection } from "next/server";
import { getAuthUser } from "@/lib/auth/supabase-server";
import { getServerSql } from "@/lib/db/server";
import { inviteStatusLabel, roleLabel } from "@/lib/services/roster-view";
import { listManagedRosters } from "@/lib/services/team-roster";
import { InviteForm, OpenInviteActions } from "./invite-forms";
import { RemoveMemberForm } from "./offboarding-forms";

/**
 * Settings > People: who is in each office or team the signed-in person
 * manages, and open invitations, with a guarded "Remove" for active members
 * (starts offboarding), "Invite someone", and Resend or Withdraw on open
 * invitations. Invitation emails go out once D-005 is set up; until then the
 * inviter is told plainly that nothing was sent. Shows nothing until D-004.
 */
export async function PeopleSection() {
  await connection();
  const sql = getServerSql();
  const user = sql ? await getAuthUser() : null;
  if (!sql || !user) {
    return (
      <p className="text-ink-muted">
        People will appear here once sign-in is set up.
      </p>
    );
  }
  const rosters = await listManagedRosters(sql, user.id);
  if (rosters.length === 0) {
    return (
      <p className="text-ink-muted">You do not manage any offices or teams.</p>
    );
  }
  const now = new Date();
  return (
    <div className="flex flex-col gap-section">
      {rosters.map((r) => (
        <section key={r.accountId} aria-label={r.name}>
          <h3 className="text-base font-semibold">{r.name}</h3>
          <ul className="mt-2 divide-y divide-border rounded-card border border-border bg-surface">
            {r.people.map((p) => {
              const invite = inviteStatusLabel(p, now);
              return (
                <li key={p.membershipId} className="flex flex-col px-4 py-3">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm text-ink-muted">
                    {p.email !== p.name ? `${p.email} · ` : ""}
                    {roleLabel(p)}
                  </span>
                  {invite ? (
                    <span className="text-sm text-ink-muted">{invite}</span>
                  ) : null}
                  {p.status === "active" && p.userId !== user.id ? (
                    <RemoveMemberForm
                      membershipId={p.membershipId}
                      name={p.name}
                      accountName={r.name}
                    />
                  ) : null}
                  {p.status === "invited" ? (
                    <OpenInviteActions
                      membershipId={p.membershipId}
                      email={p.email}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          <InviteForm accountId={r.accountId} accountName={r.name} />
        </section>
      ))}
    </div>
  );
}
