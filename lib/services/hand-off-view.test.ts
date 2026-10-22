import { describe, expect, it } from "vitest";
import { handOffSummary, itemLabel, itemStatusLabel } from "./hand-off-view";
import type { HandOffItem } from "./hand-offs";

const lead = { userId: "u-lead", name: "Lee Lead" };
const item = (over: Partial<HandOffItem>): HandOffItem => ({
  transferId: "t",
  itemType: "organization_agent_settings",
  status: "pending",
  defaultTo: lead,
  to: null,
  ...over,
});

describe("hand-off labels", () => {
  it("names known items plainly and falls back for new ones", () => {
    expect(itemLabel("agent_profiles")).toBe("Their personal agent profile");
    expect(itemLabel("curb_pages")).toBe("curb pages");
  });

  it("describes every status", () => {
    expect(itemStatusLabel(item({}))).toBe(
      "Goes to Lee Lead unless you choose someone else",
    );
    expect(itemStatusLabel(item({ defaultTo: null }))).toBe(
      "No default. Choose who takes this over.",
    );
    expect(itemStatusLabel(item({ status: "accepted", to: lead }))).toBe(
      "Handed to Lee Lead",
    );
    expect(
      itemStatusLabel(
        item({ status: "reassigned", to: { userId: "x", name: "Sam" } }),
      ),
    ).toBe("Reassigned to Sam");
    expect(itemStatusLabel(item({ status: "not_transferable" }))).toMatch(
      /Stays with them/,
    );
  });

  it("counts what still needs a decision and what accept-all would cover", () => {
    expect(
      handOffSummary({
        items: [
          item({}),
          item({ defaultTo: null }),
          item({ status: "accepted", to: lead }),
          item({ status: "not_transferable" }),
        ],
      }),
    ).toEqual({ pending: 2, acceptable: 1 });
  });
});
