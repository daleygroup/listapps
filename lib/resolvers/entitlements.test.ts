import { describe, expect, it } from "vitest";
import {
  appAccess,
  entitledApplications,
  type EntitlementContext,
} from "./entitlements";
import { member, tree } from "./fixtures.test-helpers";
import type { Subscription } from "./types";

const NOW = new Date("2026-11-01T12:00:00Z");

function sub(
  id: string,
  accountId: string,
  applicationId: string,
  extra: Partial<Subscription> = {},
): Subscription {
  return {
    id,
    accountId,
    applicationId,
    status: "active",
    trialEndsAt: null,
    includesDescendants: false,
    seatLimit: null,
    seatsUsed: 0,
    ...extra,
  };
}

const MEMBERSHIPS = [
  member("admin", "team-a1", "admin"),
  member("agent", "team-a1", "member"),
  member("agent", "ind-alice", "owner"),
  member("other-office", "brk-b", "member"),
  member("unrelated", "brk-x", "member"),
];

function ctx(
  subscriptions: Subscription[],
  extra: Partial<EntitlementContext> = {},
): EntitlementContext {
  return {
    tree: tree(),
    memberships: MEMBERSHIPS,
    subscriptions,
    now: NOW,
    ...extra,
  };
}

describe("brokerage-wide purchase flows down when includesDescendants is on", () => {
  const c = ctx([
    sub("s1", "brk-a", "listvault", { includesDescendants: true }),
  ]);

  it("reaches the team admin and the team member", () => {
    expect(appAccess(c, "admin", "listvault")).toBe("full");
    expect(appAccess(c, "agent", "listvault")).toBe("full");
  });

  it("does not reach a sibling office or an unrelated brokerage", () => {
    expect(appAccess(c, "other-office", "listvault")).toBe("none");
    expect(appAccess(c, "unrelated", "listvault")).toBe("none");
  });
});

describe("office-only purchase", () => {
  it("does not flow to teams beneath when includesDescendants is off", () => {
    const c = ctx([sub("s1", "brk-a", "openly")]);
    expect(appAccess(c, "agent", "openly")).toBe("none");
  });

  it("organization purchase reaches every office when it includes descendants", () => {
    const c = ctx([
      sub("s1", "org-1", "openly", { includesDescendants: true }),
    ]);
    expect(appAccess(c, "agent", "openly")).toBe("full");
    expect(appAccess(c, "other-office", "openly")).toBe("full");
    expect(appAccess(c, "unrelated", "openly")).toBe("none");
  });
});

describe("individual purchases and combinations", () => {
  it("an agent's own individual subscription works with nothing above", () => {
    const c = ctx([sub("s1", "ind-alice", "curb")]);
    expect(appAccess(c, "agent", "curb")).toBe("full");
    expect(appAccess(c, "admin", "curb")).toBe("none");
  });

  it("brokerage ListVault plus the agent's own Curb both resolve", () => {
    const c = ctx([
      sub("s1", "brk-a", "listvault", { includesDescendants: true }),
      sub("s2", "ind-alice", "curb"),
    ]);
    expect(
      entitledApplications(c, "agent", ["listvault", "curb", "openly"]),
    ).toEqual(["listvault", "curb"]);
    expect(
      entitledApplications(c, "admin", ["listvault", "curb", "openly"]),
    ).toEqual(["listvault"]);
  });

  it("a team purchase covers the team's own members (Q3 in proposal 001)", () => {
    const c = ctx([
      sub("s1", "team-a1", "pulse", { seatLimit: 5, seatsUsed: 2 }),
    ]);
    expect(appAccess(c, "agent", "pulse")).toBe("full");
  });
});

describe("seats", () => {
  it("a full subscription denies new users but keeps existing seat holders", () => {
    const s = sub("s1", "brk-a", "listvault", {
      includesDescendants: true,
      seatLimit: 1,
      seatsUsed: 1,
    });
    const c = ctx([s], { holdsSeat: (_s, userId) => userId === "admin" });
    expect(appAccess(c, "admin", "listvault")).toBe("full");
    expect(appAccess(c, "agent", "listvault")).toBe("read_only");
  });
});

describe("trials and lapses (data is never deleted)", () => {
  it("an unexpired trial grants access; an expired one is read-only", () => {
    const live = ctx([
      sub("s1", "ind-alice", "curb", {
        status: "trialing",
        trialEndsAt: new Date("2026-11-15T00:00:00Z"),
      }),
    ]);
    expect(appAccess(live, "agent", "curb")).toBe("full");

    const expired = ctx([
      sub("s1", "ind-alice", "curb", {
        status: "trialing",
        trialEndsAt: new Date("2026-10-15T00:00:00Z"),
      }),
    ]);
    expect(appAccess(expired, "agent", "curb")).toBe("read_only");
  });

  it("a lapsed brokerage subscription leaves agents read-only, not locked out", () => {
    const c = ctx([
      sub("s1", "brk-a", "listvault", {
        includesDescendants: true,
        status: "lapsed",
      }),
    ]);
    expect(appAccess(c, "agent", "listvault")).toBe("read_only");
  });

  it("an agent's own subscription restores full access after the brokerage lapses", () => {
    const c = ctx([
      sub("s1", "brk-a", "listvault", {
        includesDescendants: true,
        status: "canceled",
      }),
      sub("s2", "ind-alice", "listvault"),
    ]);
    expect(appAccess(c, "agent", "listvault")).toBe("full");
  });

  it("removed memberships stop entitlements immediately", () => {
    const c: EntitlementContext = {
      tree: tree(),
      memberships: [member("gone", "team-a1", "member", { status: "removed" })],
      subscriptions: [
        sub("s1", "brk-a", "listvault", { includesDescendants: true }),
      ],
      now: NOW,
    };
    expect(appAccess(c, "gone", "listvault")).toBe("none");
  });
});
