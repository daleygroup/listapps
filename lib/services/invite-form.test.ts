import { describe, expect, it } from "vitest";
import { inviteSentNotice, parseInviteForm } from "./invite-form";

const ACCOUNT = "00000000-0000-4000-8000-000000000001";
function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("parseInviteForm", () => {
  it("accepts a clean invite and lowercases the email", () => {
    expect(
      parseInviteForm(
        form({
          accountId: ACCOUNT,
          email: " New@Example.TEST ",
          role: "admin",
        }),
      ),
    ).toEqual({
      ok: true,
      accountId: ACCOUNT,
      email: "new@example.test",
      role: "admin",
    });
  });
  it("defaults to member", () => {
    const r = parseInviteForm(form({ accountId: ACCOUNT, email: "a@b.co" }));
    expect(r.ok && r.role).toBe("member");
  });
  it("refuses a bad account id, email, or role", () => {
    expect(parseInviteForm(form({ accountId: "x", email: "a@b.co" })).ok).toBe(
      false,
    );
    expect(
      parseInviteForm(form({ accountId: ACCOUNT, email: "nope" })).ok,
    ).toBe(false);
    expect(
      parseInviteForm(
        form({ accountId: ACCOUNT, email: "a@b.co", role: "superadmin" }),
      ).ok,
    ).toBe(false);
  });
});

describe("inviteSentNotice", () => {
  it("says plainly when nothing was emailed, and why", () => {
    expect(
      inviteSentNotice(
        "a@b.co",
        { sent: false, reason: "No email yet." },
        "new",
      ),
    ).toBe(
      "Invitation saved for a@b.co, but no email was sent. No email yet. Use Resend once email is set up.",
    );
  });
  it("confirms a sent invitation and a sent resend", () => {
    expect(inviteSentNotice("a@b.co", { sent: true }, "new")).toBe(
      "Invitation emailed to a@b.co. The link lasts 7 days.",
    );
    expect(inviteSentNotice("a@b.co", { sent: true }, "resend")).toContain(
      "old link no longer works",
    );
  });
});
