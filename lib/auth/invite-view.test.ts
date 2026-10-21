import { describe, expect, it } from "vitest";
import type { InvitationPreview } from "@/lib/services/invitations";
import {
  inviteView,
  maskEmail,
  parseAcknowledged,
  parseInviteToken,
  roleLabel,
  tokenFromParam,
} from "./invite-view";

const preview = (over: Partial<InvitationPreview> = {}): InvitationPreview => ({
  membershipId: "m1",
  state: "open",
  accountName: "Sample Team",
  accountType: "team",
  role: "member",
  invitedEmail: "pat@example.com",
  inviterName: "Lee",
  expiresAt: new Date("2026-11-01T00:00:00Z"),
  contactRetentionPolicy: null,
  ...over,
});

describe("inviteView", () => {
  it("says sign-in is not set up before anything else", () => {
    expect(
      inviteView({ configured: false, preview: preview(), signedInEmail: null })
        .kind,
    ).toBe("not-configured");
  });

  it("treats an unknown or revoked link as invalid without detail", () => {
    expect(
      inviteView({ configured: true, preview: null, signedInEmail: null }),
    ).toEqual({ kind: "invalid" });
  });

  it("reports used and expired links before looking at who is signed in", () => {
    expect(
      inviteView({
        configured: true,
        preview: preview({ state: "used" }),
        signedInEmail: "pat@example.com",
      }).kind,
    ).toBe("used");
    expect(
      inviteView({
        configured: true,
        preview: preview({ state: "expired" }),
        signedInEmail: null,
      }).kind,
    ).toBe("expired");
  });

  it("offers sign-in or account creation when nobody is signed in", () => {
    expect(
      inviteView({ configured: true, preview: preview(), signedInEmail: null })
        .kind,
    ).toBe("sign-in-or-create");
  });

  it("refuses a different signed-in address and masks the invited one", () => {
    const v = inviteView({
      configured: true,
      preview: preview(),
      signedInEmail: "someone@else.com",
    });
    expect(v).toEqual({
      kind: "wrong-email",
      accountName: "Sample Team",
      maskedInvitedEmail: "p***@example.com",
      signedInEmail: "someone@else.com",
    });
  });

  it("lets the invited person accept, ignoring letter case", () => {
    expect(
      inviteView({
        configured: true,
        preview: preview(),
        signedInEmail: "Pat@Example.com",
      }).kind,
    ).toBe("accept");
  });
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("joseph@example.com")).toBe("j*****@example.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });
  it("never echoes something that is not an address", () => {
    expect(maskEmail("nonsense")).toBe("***");
    expect(maskEmail("@example.com")).toBe("***");
  });
});

describe("form parsing", () => {
  const form = (entries: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
  };

  it("only counts the acknowledgement when the box was ticked", () => {
    expect(parseAcknowledged(form({ ack: "yes" }))).toBe(true);
    expect(parseAcknowledged(form({ ack: "on" }))).toBe(false);
    expect(parseAcknowledged(form({}))).toBe(false);
  });

  it("accepts only a plausible token", () => {
    const good = "a".repeat(43);
    expect(parseInviteToken(form({ token: good }))).toBe(good);
    expect(parseInviteToken(form({ token: "short" }))).toBeNull();
    expect(parseInviteToken(form({ token: `${good}/../x` }))).toBeNull();
    expect(parseInviteToken(form({}))).toBeNull();
  });

  it("reads the route segment safely", () => {
    const good = "b".repeat(43);
    expect(tokenFromParam(good)).toBe(good);
    expect(tokenFromParam("%E0%A4%A")).toBeNull();
    expect(tokenFromParam("..%2F..%2Fetc")).toBeNull();
  });

  it("describes roles in plain words", () => {
    expect(roleLabel("admin")).toBe("an admin");
  });
});
