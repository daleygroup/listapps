import { describe, expect, it } from "vitest";
import {
  canAccessAccount,
  canGrantRole,
  hasPermission,
  strongestRole,
  type AuthorityContext,
} from "./permissions";
import { member, ROLE_PERMISSIONS, tree } from "./fixtures.test-helpers";

function ctx(memberships: AuthorityContext["memberships"]): AuthorityContext {
  return { tree: tree(), memberships, rolePermissions: ROLE_PERMISSIONS };
}

describe("authority flows downward only", () => {
  const c = ctx([
    member("org-owner", "org-1", "owner"),
    member("brk-admin", "brk-a", "admin"),
    member("team-owner", "team-a1", "owner"),
    member("agent", "team-a1", "member"),
  ]);

  it("an organization owner reaches every office and team beneath", () => {
    for (const id of ["org-1", "brk-a", "team-a1", "team-a2", "brk-b"]) {
      expect(canAccessAccount(c, "org-owner", id)).toBe(true);
    }
  });

  it("a brokerage admin reaches its teams but not sibling offices or the org", () => {
    expect(canAccessAccount(c, "brk-admin", "team-a2")).toBe(true);
    expect(canAccessAccount(c, "brk-admin", "brk-b")).toBe(false);
    expect(canAccessAccount(c, "brk-admin", "org-1")).toBe(false);
  });

  it("a team owner has nothing above or beside the team", () => {
    expect(canAccessAccount(c, "team-owner", "team-a1")).toBe(true);
    expect(canAccessAccount(c, "team-owner", "brk-a")).toBe(false);
    expect(canAccessAccount(c, "team-owner", "team-a2")).toBe(false);
  });

  it("nobody reaches an unrelated brokerage or someone's individual account", () => {
    for (const u of ["org-owner", "brk-admin", "team-owner", "agent"]) {
      expect(canAccessAccount(c, u, "brk-x")).toBe(false);
      expect(canAccessAccount(c, u, "ind-alice")).toBe(false);
    }
  });

  it("unknown accounts are simply not accessible", () => {
    expect(canAccessAccount(c, "org-owner", "nope")).toBe(false);
  });
});

describe("membership status", () => {
  it("invited and removed memberships grant nothing", () => {
    const c = ctx([
      member("u1", "team-a1", "owner", { status: "invited" }),
      member("u2", "team-a1", "owner", { status: "removed" }),
    ]);
    expect(canAccessAccount(c, "u1", "team-a1")).toBe(false);
    expect(canAccessAccount(c, "u2", "team-a1")).toBe(false);
    expect(hasPermission(c, "u2", "team-a1", "members.manage")).toBe(false);
  });
});

describe("capabilities come from role_permissions, keyed by account type", () => {
  const c = ctx([
    member("brk-admin", "brk-a", "admin"),
    member("team-owner", "team-a1", "owner"),
    member("agent", "team-a1", "member"),
    member("bor", "brk-a", "member", { isBrokerOfRecord: true }),
  ]);

  it("members can see but not manage", () => {
    expect(canAccessAccount(c, "agent", "team-a1")).toBe(true);
    expect(hasPermission(c, "agent", "team-a1", "members.invite")).toBe(false);
  });

  it("a brokerage admin's capabilities apply to teams beneath", () => {
    expect(hasPermission(c, "brk-admin", "team-a1", "members.invite")).toBe(
      true,
    );
    expect(hasPermission(c, "brk-admin", "team-a1", "listing.reassign")).toBe(
      true,
    );
  });

  it("listing.reassign exists only at brokerage scope, not for team owners", () => {
    expect(hasPermission(c, "team-owner", "team-a1", "listing.reassign")).toBe(
      false,
    );
  });

  it("the broker-of-record flag adds its own capabilities", () => {
    expect(hasPermission(c, "bor", "team-a2", "compliance.review")).toBe(true);
    expect(hasPermission(c, "brk-admin", "team-a2", "compliance.review")).toBe(
      false,
    );
  });
});

describe("nobody can grant a role higher than their own", () => {
  const c = ctx([
    member("brk-owner", "brk-a", "owner"),
    member("team-admin", "team-a1", "admin"),
    member("agent", "team-a1", "member"),
  ]);

  it("an admin can grant member or admin, never owner", () => {
    expect(canGrantRole(c, "team-admin", "team-a1", "member")).toBe(true);
    expect(canGrantRole(c, "team-admin", "team-a1", "admin")).toBe(true);
    expect(canGrantRole(c, "team-admin", "team-a1", "owner")).toBe(false);
  });

  it("an owner above can grant owner below", () => {
    expect(strongestRole(c, "brk-owner", "team-a1")).toBe("owner");
    expect(canGrantRole(c, "brk-owner", "team-a1", "owner")).toBe(true);
  });

  it("a team admin cannot grant anything on the brokerage above", () => {
    expect(canGrantRole(c, "team-admin", "brk-a", "member")).toBe(false);
  });

  it("members cannot grant at all", () => {
    expect(canGrantRole(c, "agent", "team-a1", "member")).toBe(false);
  });
});
