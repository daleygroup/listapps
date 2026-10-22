import type { RosterPerson } from "./team-roster";

/** Plain-language labels for the People list. Pure, unit-tested. */
export function roleLabel(
  p: Pick<RosterPerson, "role" | "isBrokerOfRecord">,
): string {
  const base = { owner: "Owner", admin: "Admin", member: "Member" }[p.role];
  return p.isBrokerOfRecord ? `${base}, broker of record` : base;
}

export function inviteStatusLabel(
  p: Pick<RosterPerson, "status" | "inviteExpiresAt">,
  now: Date,
): string | null {
  if (p.status !== "invited") return null;
  if (!p.inviteExpiresAt || p.inviteExpiresAt <= now) {
    return "Invitation expired";
  }
  const hours = (p.inviteExpiresAt.getTime() - now.getTime()) / 3_600_000;
  if (hours < 24) return "Invited, link expires today";
  const days = Math.floor(hours / 24);
  return `Invited, link expires in ${days} day${days === 1 ? "" : "s"}`;
}
