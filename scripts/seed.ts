import postgres from "postgres";
import { assertSafeDbTarget } from "../lib/db/guard";
import { seedMilestone1 } from "../db/seed/milestone1";

// Usage: LISTAPPS_DB_TARGET=local DATABASE_URL=... pnpm db:seed [owner-email]
async function main() {
  assertSafeDbTarget(process.env);
  const ownerEmail = process.argv[2];
  const sql = postgres(process.env.DATABASE_URL!, {
    max: 1,
    onnotice: () => {},
  });
  try {
    const result = await seedMilestone1(sql, { ownerEmail });
    console.log("Seeded:", result);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
