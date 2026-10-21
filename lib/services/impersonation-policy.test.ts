import { describe, expect, it } from "vitest";
import { checkImpersonatedAction } from "./impersonation-policy";

const read = (name: string) => ({ name, writes: false });
const write = (name: string) => ({ name, writes: true });

describe("checkImpersonatedAction", () => {
  it("allows reads in a read-only session", () => {
    expect(checkImpersonatedAction("read_only", read("listing.view"))).toEqual({
      allowed: true,
    });
  });

  it("blocks writes in a read-only session", () => {
    const v = checkImpersonatedAction("read_only", write("listing.update"));
    expect(v.allowed).toBe(false);
  });

  it("allows ordinary writes once elevated", () => {
    expect(
      checkImpersonatedAction("elevated", write("listing.update")).allowed,
    ).toBe(true);
  });

  it.each([
    read("contacts.export"),
    write("contacts.export"),
    write("contacts.export.csv"),
    write("user.password.change"),
    write("user.email"),
    write("auth.email.change"),
    write("billing.update"),
    write("subscription.cancel"),
    write("listing.delete"),
    write("contacts.purge"),
    read("media.delete"),
  ])("never allows $name (writes=$writes), even elevated", (action) => {
    const v = checkImpersonatedAction("elevated", action);
    expect(v.allowed).toBe(false);
  });

  it("lets support look at billing and email without changing them", () => {
    expect(
      checkImpersonatedAction("read_only", read("billing.view")).allowed,
    ).toBe(true);
    expect(
      checkImpersonatedAction("read_only", read("user.email")).allowed,
    ).toBe(true);
  });

  it("is not fooled by case or spacing", () => {
    expect(
      checkImpersonatedAction("elevated", write("  Contacts.Export ")).allowed,
    ).toBe(false);
  });

  it("does not treat names that merely contain a forbidden word as forbidden", () => {
    expect(
      checkImpersonatedAction("elevated", write("listing.deleted_flag_view"))
        .allowed,
    ).toBe(true);
  });
});
