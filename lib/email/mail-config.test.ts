import { describe, expect, it } from "vitest";
import {
  EMAIL_NOT_CHOSEN,
  emailLinkOrigin,
  mailerFromEnv,
  SITE_URL_MISSING,
} from "./mail-config";

const email = { to: "a@example.test", subject: "s", text: "t" };

describe("emailLinkOrigin", () => {
  it("is null when the site address is not pinned", () => {
    expect(emailLinkOrigin({})).toBeNull();
    expect(emailLinkOrigin({ LISTAPPS_SITE_URL: "  " })).toBeNull();
  });
  it("uses only the origin of the pinned address", () => {
    expect(
      emailLinkOrigin({ LISTAPPS_SITE_URL: "https://app.example.test/x?y=1" }),
    ).toBe("https://app.example.test");
    expect(
      emailLinkOrigin({ LISTAPPS_SITE_URL: "http://localhost:3000" }),
    ).toBe("http://localhost:3000");
  });
  it("refuses plain http off localhost and garbage", () => {
    expect(() =>
      emailLinkOrigin({ LISTAPPS_SITE_URL: "http://app.example.test" }),
    ).toThrow(/https/);
    expect(() => emailLinkOrigin({ LISTAPPS_SITE_URL: "not a url" })).toThrow(
      /valid URL/,
    );
    expect(() =>
      emailLinkOrigin({ LISTAPPS_SITE_URL: "javascript:alert(1)" }),
    ).toThrow(/https/);
  });
});

describe("mailerFromEnv", () => {
  it("sends nothing and says why while no site address is set", async () => {
    expect(await mailerFromEnv({}).send(email)).toEqual({
      sent: false,
      reason: SITE_URL_MISSING,
    });
  });
  it("sends nothing until an email service is chosen (D-005)", async () => {
    const mailer = mailerFromEnv({
      LISTAPPS_SITE_URL: "https://app.example.test",
    });
    expect(await mailer.send(email)).toEqual({
      sent: false,
      reason: EMAIL_NOT_CHOSEN,
    });
  });
});
