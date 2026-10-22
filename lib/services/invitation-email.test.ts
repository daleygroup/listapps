import { describe, expect, it } from "vitest";
import { invitationEmail } from "./invitation-email";

const base = {
  toEmail: "new.agent@example.test",
  accountName: "Team One",
  role: "member" as const,
  inviterName: "Olive Owner",
  acceptUrl: "https://app.example.test/invite/abc123",
  expiresAt: new Date("2026-10-29T15:00:00Z"),
  timeZone: "America/Chicago",
};

describe("invitationEmail", () => {
  it("names who invited them, where, and as what, with the link", () => {
    const e = invitationEmail(base);
    expect(e.to).toBe("new.agent@example.test");
    expect(e.subject).toBe(
      "Olive Owner invited you to join Team One on ListApps",
    );
    expect(e.text).toContain(
      "Olive Owner invited you to join Team One on ListApps as a member.",
    );
    expect(e.text).toContain("\nhttps://app.example.test/invite/abc123\n");
    expect(e.text).toContain(
      "only for this email address (new.agent@example.test)",
    );
    expect(e.text).toContain(
      "Every contact you own stays yours if you ever leave.",
    );
  });

  it("shows the expiry in the office's own time zone", () => {
    expect(invitationEmail(base).text).toContain(
      "expires Thursday, October 29 at 10:00 AM CDT.",
    );
    expect(invitationEmail({ ...base, timeZone: "Not/AZone" }).text).toContain(
      "3:00 PM UTC",
    );
  });

  it("uses the right article for each role", () => {
    expect(invitationEmail({ ...base, role: "admin" }).text).toContain(
      "as an admin.",
    );
    expect(invitationEmail({ ...base, role: "owner" }).text).toContain(
      "as an owner.",
    );
  });

  it("never lets a name break the subject line", () => {
    const e = invitationEmail({
      ...base,
      inviterName: "Olive\r\nBcc: x@example.test",
      accountName: "Team\nOne",
    });
    expect(e.subject).not.toMatch(/[\r\n]/);
    expect(e.subject).toBe(
      "Olive Bcc: x@example.test invited you to join Team One on ListApps",
    );
  });

  it("falls back when the inviter has no name", () => {
    expect(invitationEmail({ ...base, inviterName: null }).subject).toBe(
      "Someone invited you to join Team One on ListApps",
    );
  });

  it("uses no em dashes (house style)", () => {
    expect(invitationEmail(base).text).not.toContain("—");
  });
});
