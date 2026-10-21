import { describe, expect, it } from "vitest";
import {
  DEFAULT_AFTER_SIGN_IN,
  isPublicPath,
  safeNextPath,
  signInRedirectPath,
} from "./routes";

describe("isPublicPath", () => {
  it("leaves sign-in, recovery, auth handlers and invitation previews open", () => {
    for (const p of [
      "/",
      "/sign-in",
      "/forgot-password",
      "/reset-password",
      "/auth/callback",
      "/auth/sign-out",
      "/invite/abc",
    ]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("protects the shell and every app", () => {
    for (const p of [
      "/settings",
      "/openly",
      "/listvault/x",
      "/curb",
      "/sign-in-elsewhere",
      "/auth",
      "/invite",
    ]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths with their query", () => {
    expect(safeNextPath("/openly?tab=mine")).toBe("/openly?tab=mine");
  });

  it("falls back for anything that could leave the site", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "/ok\nLocation: x",
      "openly",
      "/sign-in",
      "/auth/callback",
      `/${"a".repeat(600)}`,
    ]) {
      expect(safeNextPath(bad), String(bad)).toBe(DEFAULT_AFTER_SIGN_IN);
    }
  });
});

describe("signInRedirectPath", () => {
  it("remembers where the person was going", () => {
    expect(signInRedirectPath("/openly", "?x=1")).toBe(
      "/sign-in?next=%2Fopenly%3Fx%3D1",
    );
  });
  it("omits next when it would be the default anyway", () => {
    expect(signInRedirectPath("/settings")).toBe("/sign-in");
  });
});
