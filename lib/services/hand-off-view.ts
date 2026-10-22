import type { HandOff, HandOffItem } from "./hand-offs";

/** Plain-language wording for the hand-off screen. Pure, unit-tested. */

const ITEM_LABELS: Record<string, string> = {
  organization_agent_settings:
    "Office settings for this person (title, office email, direct line, office bio)",
  agent_profiles: "Their personal agent profile",
};

export function itemLabel(itemType: string): string {
  return ITEM_LABELS[itemType] ?? itemType.replaceAll("_", " ");
}

export function itemStatusLabel(item: HandOffItem): string {
  switch (item.status) {
    case "not_transferable":
      return "Stays with them. Nobody takes this over.";
    case "accepted":
      return `Handed to ${item.to?.name ?? "the default"}`;
    case "reassigned":
      return `Reassigned to ${item.to?.name ?? "someone else"}`;
    case "pending":
      return item.defaultTo
        ? `Goes to ${item.defaultTo.name} unless you choose someone else`
        : "No default. Choose who takes this over.";
  }
}

/** How many items still need a decision, and whether "accept all" can help. */
export function handOffSummary(h: Pick<HandOff, "items">): {
  pending: number;
  acceptable: number;
} {
  const pending = h.items.filter((i) => i.status === "pending");
  return {
    pending: pending.length,
    acceptable: pending.filter((i) => i.defaultTo !== null).length,
  };
}
