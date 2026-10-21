import "server-only";
import { getShellView, type ShellView } from "./app-shell";
import {
  shellFixture,
  SHELL_FIXTURE_USER_ID,
} from "@/lib/fixtures/shell-fixture";

/**
 * The shell view for the signed-in user. Until authentication (M1-5) and the
 * Milestone 1 tables exist, this reads fixture data for a sample user.
 */
const FIXTURE_NOW = new Date("2026-01-01T00:00:00Z");

export function getCurrentShellView(): ShellView {
  // Fixture data is static, so a fixed clock keeps these pages prerenderable.
  // The real version runs per request (it depends on the session).
  return getShellView(shellFixture, SHELL_FIXTURE_USER_ID, FIXTURE_NOW);
}
