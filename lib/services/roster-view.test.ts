import { describe, expect, it } from "vitest";
import { inviteStatusLabel, roleLabel } from "./roster-view";

const now = new Date("2026-10-22T12:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("roster labels", () => {
  it("names roles plainly and adds broker of record", () => {
    expect(roleLabel({ role: "admin", isBrokerOfRecord: false })).toBe("Admin");
    expect(roleLabel({ role: "owner", isBrokerOfRecord: true })).toBe(
      "Owner, broker of record",
    );
  });

  it("describes invitation state", () => {
    expect(
      inviteStatusLabel({ status: "active", inviteExpiresAt: null }, now),
    ).toBeNull();
    expect(
      inviteStatusLabel(
        { status: "invited", inviteExpiresAt: inHours(-1) },
        now,
      ),
    ).toBe("Invitation expired");
    expect(
      inviteStatusLabel(
        { status: "invited", inviteExpiresAt: inHours(5) },
        now,
      ),
    ).toBe("Invited, link expires today");
    expect(
      inviteStatusLabel(
        { status: "invited", inviteExpiresAt: inHours(30) },
        now,
      ),
    ).toBe("Invited, link expires in 1 day");
    expect(
      inviteStatusLabel(
        { status: "invited", inviteExpiresAt: inHours(24 * 7) },
        now,
      ),
    ).toBe("Invited, link expires in 7 days");
  });
});
