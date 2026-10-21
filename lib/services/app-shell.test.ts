import { describe, expect, it } from "vitest";
import { getShellView, type ShellDataSource } from "./app-shell";
import {
  shellFixture,
  SHELL_FIXTURE_USER_ID,
} from "@/lib/fixtures/shell-fixture";

describe("getShellView", () => {
  it("shows apps from the brokerage (flowing down) and the agent's own purchase", () => {
    const view = getShellView(shellFixture, SHELL_FIXTURE_USER_ID);
    expect(view.apps.map((a) => a.slug)).toEqual([
      "openly",
      "listvault",
      "curb",
    ]);
    expect(view.accountName).toBe("Sample Team");
    expect(view.apps[0].href).toBe("/openly");
  });

  it("hides apps that are coming soon even when subscribed", () => {
    const source: ShellDataSource = {
      ...shellFixture,
      subscriptions: [
        ...shellFixture.subscriptions,
        {
          id: "s-pulse",
          accountId: "acct-team",
          applicationId: "app-pulse",
          status: "active",
          trialEndsAt: null,
          includesDescendants: false,
          seatLimit: null,
          seatsUsed: 0,
        },
      ],
    };
    expect(
      getShellView(source, SHELL_FIXTURE_USER_ID).apps.map((a) => a.slug),
    ).not.toContain("pulse");
  });

  it("shows nothing when nothing is subscribed", () => {
    const view = getShellView(
      { ...shellFixture, subscriptions: [] },
      SHELL_FIXTURE_USER_ID,
    );
    expect(view.apps).toEqual([]);
  });

  it("rejects unknown users", () => {
    expect(() => getShellView(shellFixture, "nobody")).toThrow(/Unknown user/);
  });
});
