/**
 * Refuses to touch any database unless the caller has explicitly declared it
 * local or development. Production migrations require a written plan approved
 * by Joseph (CLAUDE.md sections 0 and 11) and are not runnable from this tool.
 */
const ALLOWED_TARGETS = ["local", "development"] as const;
export type DbTarget = (typeof ALLOWED_TARGETS)[number];

export function assertSafeDbTarget(
  env: Record<string, string | undefined>,
): DbTarget {
  const target = env.LISTAPPS_DB_TARGET;
  const url = env.DATABASE_URL ?? "";
  if (/production/i.test(url) || /production/i.test(target ?? "")) {
    throw new Error("Refusing to run against a production database.");
  }
  if (!target || !(ALLOWED_TARGETS as readonly string[]).includes(target)) {
    throw new Error(
      `Set LISTAPPS_DB_TARGET to one of: ${ALLOWED_TARGETS.join(", ")}. Got: ${target ?? "(unset)"}`,
    );
  }
  if (!url) throw new Error("DATABASE_URL is not set.");
  return target as DbTarget;
}
