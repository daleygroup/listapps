import { connection } from "next/server";
import { getAuthUser } from "@/lib/auth/supabase-server";
import { getServerSql } from "@/lib/db/server";
import {
  handOffSummary,
  itemLabel,
  itemStatusLabel,
} from "@/lib/services/hand-off-view";
import { listHandOffs } from "@/lib/services/hand-offs";
import { AcceptDefaultsForm, ReassignForm } from "./offboarding-forms";

/**
 * Settings > Hand-offs: when someone leaves, what they held here and who it
 * goes to. Defaults point at the next authority up; the person reading can
 * accept them all or send items elsewhere. Shows nothing until D-004.
 */
export async function HandOffsSection() {
  await connection();
  const sql = getServerSql();
  const user = sql ? await getAuthUser() : null;
  if (!sql || !user) {
    return (
      <p className="text-ink-muted">
        Hand-offs will appear here once sign-in is set up.
      </p>
    );
  }
  const handOffs = await listHandOffs(sql, user.id);
  if (handOffs.length === 0) {
    return <p className="text-ink-muted">Nothing waiting on you.</p>;
  }
  return (
    <div className="flex flex-col gap-section">
      {handOffs.map((h) => {
        const { pending, acceptable } = handOffSummary(h);
        return (
          <section
            key={h.membershipId}
            aria-label={`${h.departed.name} hand-off`}
            className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
          >
            <div>
              <h3 className="text-base font-semibold">{h.departed.name}</h3>
              <p className="text-sm text-ink-muted">
                Removed from {h.accountName}. {pending} item
                {pending === 1 ? "" : "s"} to decide.
              </p>
            </div>
            <ul className="divide-y divide-border">
              {h.items.map((i) => (
                <li key={i.transferId} className="flex flex-col py-3">
                  <span className="font-medium">{itemLabel(i.itemType)}</span>
                  <span className="text-sm text-ink-muted">
                    {itemStatusLabel(i)}
                  </span>
                  {i.status === "pending" ? (
                    <ReassignForm
                      transferId={i.transferId}
                      candidates={h.candidates}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
            {acceptable > 0 ? (
              <AcceptDefaultsForm
                membershipId={h.membershipId}
                count={acceptable}
              />
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
