import { describe, expect, it } from "vitest";
import { readAuthConfig } from "./config";

const good = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc123.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("readAuthConfig", () => {
  it("is not configured until D-004 supplies the project", () => {
    expect(readAuthConfig({}).configured).toBe(false);
    expect(
      readAuthConfig({
        NEXT_PUBLIC_SUPABASE_URL: good.NEXT_PUBLIC_SUPABASE_URL,
      }).configured,
    ).toBe(false);
  });

  it("returns the URL origin and anon key when both are set", () => {
    expect(readAuthConfig(good)).toEqual({
      configured: true,
      url: "https://abc123.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("refuses a service role key exposed to the browser", () => {
    expect(() =>
      readAuthConfig({ ...good, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "x" }),
    ).toThrow(/never be public/);
    expect(() =>
      readAuthConfig({ ...good, NEXT_PUBLIC_SOMETHING_SECRET: "x" }),
    ).toThrow(/never be public/);
  });

  it("refuses a production project unless explicitly allowed", () => {
    const prod = {
      ...good,
      NEXT_PUBLIC_SUPABASE_URL: "https://listapps-production.example.com",
    };
    expect(() => readAuthConfig(prod)).toThrow(/production/);
    expect(
      readAuthConfig({ ...prod, LISTAPPS_ALLOW_PRODUCTION_AUTH: "yes" })
        .configured,
    ).toBe(true);
  });

  it("requires https except on localhost", () => {
    expect(() =>
      readAuthConfig({ ...good, NEXT_PUBLIC_SUPABASE_URL: "http://abc.co" }),
    ).toThrow(/https/);
    expect(
      readAuthConfig({
        ...good,
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      }).configured,
    ).toBe(true);
    expect(() =>
      readAuthConfig({ ...good, NEXT_PUBLIC_SUPABASE_URL: "not a url" }),
    ).toThrow(/valid URL/);
  });
});
