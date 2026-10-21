import { describe, expect, it } from "vitest";
import {
  callbackErrorMessage,
  parseEmail,
  parseNewPassword,
  parseSignIn,
} from "./forms";

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

describe("auth forms", () => {
  it("normalizes email and rejects junk", () => {
    expect(parseEmail(fd({ email: "  Joe@Example.COM " }))).toBe(
      "joe@example.com",
    );
    expect(parseEmail(fd({ email: "nope" }))).toBeNull();
    expect(parseEmail(fd({}))).toBeNull();
  });

  it("requires both sign-in fields", () => {
    expect(parseSignIn(fd({ email: "a@b.co" })).ok).toBe(false);
    expect(parseSignIn(fd({ email: "a@b.co", password: "x" }))).toEqual({
      ok: true,
      email: "a@b.co",
      password: "x",
    });
  });

  it("checks new password length and confirmation", () => {
    expect(
      parseNewPassword(fd({ password: "short", confirm: "short" })).ok,
    ).toBe(false);
    expect(
      parseNewPassword(
        fd({ password: "a".repeat(73), confirm: "a".repeat(73) }),
      ).ok,
    ).toBe(false);
    expect(
      parseNewPassword(fd({ password: "longenough", confirm: "different1" })),
    ).toEqual({ ok: false, error: "The two passwords do not match." });
    expect(
      parseNewPassword(fd({ password: "longenough", confirm: "longenough" })),
    ).toEqual({ ok: true, password: "longenough" });
  });

  it("maps only known callback errors", () => {
    expect(callbackErrorMessage("link")).toMatch(/expired/);
    expect(callbackErrorMessage("<script>")).toBeNull();
    expect(callbackErrorMessage(null)).toBeNull();
  });
});
