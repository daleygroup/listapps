import "server-only";
import { authConfigFromProcess } from "@/lib/auth/config";
import { getAuthUser } from "@/lib/auth/supabase-server";
import { getServerSql } from "@/lib/db/server";
import {
  shellFixture,
  SHELL_FIXTURE_USER_ID,
} from "@/lib/fixtures/shell-fixture";
import type { ShellView } from "./app-shell";
import { loadShellDataSource } from "./shell-data";
import { resolveShellView } from "./shell-source";

/** Fixture data is static, so a fixed clock keeps it deterministic. */
const FIXTURE_NOW = new Date("2026-01-01T00:00:00Z");

/**
 * The shell view for this request: real data for the signed-in person once
 * sign-in is set up (D-004), sample fixture data until then.
 * Call it per request (after `connection()`), never at build time.
 */
export async function getCurrentShellView(): Promise<ShellView> {
  return resolveShellView({
    authConfigured: authConfigFromProcess().configured,
    fixture: {
      source: shellFixture,
      userId: SHELL_FIXTURE_USER_ID,
      now: FIXTURE_NOW,
    },
    getUser: getAuthUser,
    loadForUser: async (userId) => {
      const sql = getServerSql();
      return sql ? loadShellDataSource(sql, userId) : null;
    },
    now: () => new Date(),
  });
}
