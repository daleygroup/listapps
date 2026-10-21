import { describe, expect, it } from "vitest";
import { bannerText } from "./impersonation-banner";

const now = new Date("2026-10-21T15:00:00Z");
const base = {
  targetName: "Pat Agent",
  mode: "read_only" as const,
  reason: "Ticket 42",
  expiresAt: new Date("2026-10-21T15:30:00Z"),
  now,
};

describe("bannerText", () => {
  it("names the person, the mode, the reason and the time left", () => {
    const t = bannerText(base);
    expect(t.headline).toBe("You are viewing ListApps as Pat Agent");
    expect(t.detail).toContain("View only");
    expect(t.detail).toContain("Reason: Ticket 42");
    expect(t.detail).toContain("ends in 30 minutes");
    expect(t.detail).toContain("They will be emailed");
    expect(t.elevated).toBe(false);
  });

  it("says plainly when changes are being saved", () => {
    const t = bannerText({ ...base, mode: "elevated" });
    expect(t.elevated).toBe(true);
    expect(t.detail).toContain("Changes you make are saved and logged");
  });

  it("rounds up, uses the singular, and never counts below zero", () => {
    expect(
      bannerText({ ...base, expiresAt: new Date(now.getTime() + 20_000) })
        .detail,
    ).toContain("ends in 1 minute.");
    const past = bannerText({
      ...base,
      expiresAt: new Date(now.getTime() - 60_000),
    });
    expect(past.minutesLeft).toBe(0);
    expect(past.detail).toContain("ends now");
  });
});
