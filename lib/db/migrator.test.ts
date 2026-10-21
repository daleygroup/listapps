import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadMigrations } from "./migrator";
import { assertSafeDbTarget } from "./guard";

function dirWith(files: string[]): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "mig-"));
  for (const f of files) writeFileSync(path.join(dir, f), "select 1;");
  return dir;
}

describe("loadMigrations", () => {
  it("loads ordered up/down pairs", () => {
    const dir = dirWith([
      "0002_b.up.sql",
      "0002_b.down.sql",
      "0001_a.up.sql",
      "0001_a.down.sql",
    ]);
    expect(loadMigrations(dir).map((m) => `${m.version}_${m.name}`)).toEqual([
      "0001_a",
      "0002_b",
    ]);
  });

  it("rejects a migration without a down file", () => {
    expect(() => loadMigrations(dirWith(["0001_a.up.sql"]))).toThrow(/down/);
  });

  it("rejects gaps in numbering", () => {
    const dir = dirWith([
      "0001_a.up.sql",
      "0001_a.down.sql",
      "0003_c.up.sql",
      "0003_c.down.sql",
    ]);
    expect(() => loadMigrations(dir)).toThrow(/gap/);
  });

  it("rejects badly named files", () => {
    expect(() => loadMigrations(dirWith(["create_users.sql"]))).toThrow(
      /does not match/,
    );
  });

  it("accepts the real migrations directory", () => {
    expect(() =>
      loadMigrations(path.resolve(__dirname, "../../db/migrations")),
    ).not.toThrow();
  });
});

describe("assertSafeDbTarget", () => {
  it("refuses when no target is declared", () => {
    expect(() =>
      assertSafeDbTarget({ DATABASE_URL: "postgres://localhost/x" }),
    ).toThrow(/LISTAPPS_DB_TARGET/);
  });

  it("refuses anything that looks like production", () => {
    expect(() =>
      assertSafeDbTarget({
        DATABASE_URL: "postgres://listapps-production.example/db",
        LISTAPPS_DB_TARGET: "development",
      }),
    ).toThrow(/production/);
    expect(() =>
      assertSafeDbTarget({
        DATABASE_URL: "postgres://localhost/x",
        LISTAPPS_DB_TARGET: "production",
      }),
    ).toThrow(/production/);
  });

  it("allows local", () => {
    expect(
      assertSafeDbTarget({
        DATABASE_URL: "postgres://localhost/x",
        LISTAPPS_DB_TARGET: "local",
      }),
    ).toBe("local");
  });
});
