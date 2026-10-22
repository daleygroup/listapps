import { describe, expect, it, vi } from "vitest";
import {
  shellFixture,
  SHELL_FIXTURE_USER_ID,
} from "@/lib/fixtures/shell-fixture";
import {
  EMPTY_SHELL_VIEW,
  resolveShellView,
  type ShellSourceDeps,
} from "./shell-source";

const fixture = {
  source: shellFixture,
  userId: SHELL_FIXTURE_USER_ID,
  now: new Date("2026-01-01T00:00:00Z"),
};

function deps(over: Partial<ShellSourceDeps>): ShellSourceDeps {
  return {
    authConfigured: true,
    fixture,
    getUser: async () => ({ id: "u1", email: "agent@example.test" }),
    loadForUser: async () => null,
    now: () => new Date("2026-10-22T00:00:00Z"),
    ...over,
  };
}

describe("resolveShellView", () => {
  it("uses the sample fixture while sign-in is not set up, without asking who is signed in", async () => {
    const getUser = vi.fn();
    const view = await resolveShellView(
      deps({ authConfigured: false, getUser }),
    );
    expect(view.userName).toBe("Sample Agent");
    expect(view.apps.map((a) => a.slug)).toEqual([
      "openly",
      "listvault",
      "curb",
    ]);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("never shows the fixture once sign-in is set up, even when signed out", async () => {
    const view = await resolveShellView(deps({ getUser: async () => null }));
    expect(view).toEqual(EMPTY_SHELL_VIEW);
  });

  it("shows an empty shell with the email when there is no data for the person yet", async () => {
    const view = await resolveShellView(deps({}));
    expect(view).toEqual({
      userName: "agent@example.test",
      accountName: null,
      apps: [],
    });
  });

  it("loads real data for the verified user id only", async () => {
    const loadForUser = vi.fn(async (id: string) => ({
      ...shellFixture,
      users: [{ id, fullName: "Real Person" }],
      memberships: shellFixture.memberships.map((m) => ({ ...m, userId: id })),
    }));
    const view = await resolveShellView(deps({ loadForUser }));
    expect(loadForUser).toHaveBeenCalledWith("u1");
    expect(view.userName).toBe("Real Person");
    expect(view.accountName).toBe("Sample Team");
  });
});
