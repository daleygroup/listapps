import { describe, expect, it } from "vitest";
import type { QueuedNotice } from "./impersonation";
import { impersonationNoticeEmail } from "./impersonation-notice";

const base: QueuedNotice = {
  sessionId: "s1",
  toEmail: "agent@example.test",
  toName: "Avery Agent",
  staffName: "Sam Support",
  startedAt: new Date("2026-10-22T14:05:00Z"),
  endedAt: new Date("2026-10-22T14:40:00Z"),
  mode: "read_only",
  reason: "Ticket 42: listing not showing",
  elevatedReason: null,
  actionCount: 3,
};

describe("impersonationNoticeEmail", () => {
  it("says who, when (in the person's time zone), why, and that it was view only", () => {
    const email = impersonationNoticeEmail(base, {
      timeZone: "America/Chicago",
    });
    expect(email.subject).toBe("ListApps support viewed your account");
    expect(email.text).toContain("Hi Avery Agent,");
    expect(email.text).toContain(
      "Sam Support from ListApps support viewed your ListApps account on Thursday, October 22, 2026, from 9:05 AM CDT to 9:40 AM CDT.",
    );
    expect(email.text).toContain(
      "Reason given: Ticket 42: listing not showing",
    );
    expect(email.text).toContain("This was view only.");
    expect(email.text).toContain("3 actions were logged");
  });

  it("says so plainly when the session was allowed to make changes, even after stepping down", () => {
    const email = impersonationNoticeEmail(
      {
        ...base,
        mode: "read_only",
        elevatedReason: "Agent asked us to fix the address",
      },
      { timeZone: "America/Chicago" },
    );
    expect(email.subject).toMatch(/allowed to change/);
    expect(email.text).toContain(
      "Reason given for that: Agent asked us to fix the address.",
    );
    expect(email.text).not.toContain("view only");
  });

  it("always states what staff can never do", () => {
    const { text } = impersonationNoticeEmail(base);
    expect(text).toContain(
      "never export your contacts, change your password or email address, change your billing, or delete anything",
    );
  });

  it("falls back to UTC for a missing or invalid time zone, and handles no name and one action", () => {
    const email = impersonationNoticeEmail(
      { ...base, toName: null, actionCount: 1 },
      { timeZone: "Not/AZone" },
    );
    expect(email.text.startsWith("Hi,\n")).toBe(true);
    expect(email.text).toContain("from 2:05 PM UTC to 2:40 PM UTC");
    expect(email.text).toContain("1 action was logged");
  });

  it("spells out both days when a session crosses midnight", () => {
    const { text } = impersonationNoticeEmail(
      {
        ...base,
        startedAt: new Date("2026-10-23T04:30:00Z"),
        endedAt: new Date("2026-10-23T05:30:00Z"),
      },
      { timeZone: "America/Chicago" },
    );
    expect(text).toContain(
      "from Thursday, October 22, 2026 at 11:30 PM CDT to Friday, October 23, 2026 at 12:30 AM CDT",
    );
  });

  it("never uses an em dash", () => {
    const { subject, text } = impersonationNoticeEmail({
      ...base,
      elevatedReason: "x",
    });
    expect(subject + text).not.toContain("—");
  });
});
