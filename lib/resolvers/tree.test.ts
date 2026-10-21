import { describe, expect, it } from "vitest";
import { AccountTree, resolveInherited, resolveMerged } from "./tree";
import { ACCOUNTS, tree } from "./fixtures.test-helpers";

describe("AccountTree", () => {
  it("lists ancestors nearest first", () => {
    expect(
      tree()
        .ancestorsOf("team-a1")
        .map((a) => a.id),
    ).toEqual(["team-a1", "brk-a", "org-1"]);
  });

  it("knows what is beneath what, and nothing sideways or upward", () => {
    const t = tree();
    expect(t.isAtOrBelow("team-a1", "org-1")).toBe(true);
    expect(t.isAtOrBelow("team-a1", "team-a1")).toBe(true);
    expect(t.isAtOrBelow("brk-a", "team-a1")).toBe(false);
    expect(t.isAtOrBelow("team-a2", "team-a1")).toBe(false);
    expect(t.isAtOrBelow("team-a1", "brk-b")).toBe(false);
  });

  it("rejects cycles, unknown parents, and duplicates", () => {
    expect(
      () =>
        new AccountTree([
          { id: "a", parentId: "b", type: "team" },
          { id: "b", parentId: "a", type: "brokerage" },
        ]),
    ).toThrow(/cycle/);
    expect(
      () => new AccountTree([{ id: "a", parentId: "zzz", type: "team" }]),
    ).toThrow(/unknown parent/);
    expect(() => new AccountTree([ACCOUNTS[0], ACCOUNTS[0]])).toThrow(
      /Duplicate/,
    );
  });
});

describe("resolveInherited (brand kits, settings)", () => {
  const kits: Record<string, string> = { "brk-a": "kit-brokerage-a" };

  it("uses the nearest ancestor with a value", () => {
    expect(resolveInherited(tree(), "team-a1", (id) => kits[id])).toBe(
      "kit-brokerage-a",
    );
  });

  it("prefers the account's own value", () => {
    const withTeam: Record<string, string> = {
      ...kits,
      "team-a1": "kit-team-a1",
    };
    expect(resolveInherited(tree(), "team-a1", (id) => withTeam[id])).toBe(
      "kit-team-a1",
    );
  });

  it("never inherits sideways and falls back when nothing is set", () => {
    expect(
      resolveInherited(tree(), "brk-b", (id) => kits[id], "platform-default"),
    ).toBe("platform-default");
    expect(resolveInherited(tree(), "brk-x", (id) => kits[id])).toBeUndefined();
  });
});

describe("resolveMerged (theme tokens)", () => {
  it("takes each token from the nearest account that sets it", () => {
    const base = { primary: "blue", font: "system", radius: "8px" };
    const overrides: Record<string, Partial<typeof base>> = {
      "org-1": { primary: "red", radius: "4px" },
      "team-a1": { primary: "green" },
    };
    expect(
      resolveMerged(tree(), "team-a1", (id) => overrides[id], base),
    ).toEqual({ primary: "green", font: "system", radius: "4px" });
    expect(resolveMerged(tree(), "brk-x", (id) => overrides[id], base)).toEqual(
      base,
    );
  });
});
