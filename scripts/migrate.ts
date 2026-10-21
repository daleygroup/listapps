import path from "node:path";
import postgres from "postgres";
import { assertSafeDbTarget } from "../lib/db/guard";
import {
  appliedVersions,
  loadMigrations,
  migrateDown,
  migrateUp,
} from "../lib/db/migrator";

const DIR = path.resolve(__dirname, "../db/migrations");

async function main() {
  const [command = "status", arg] = process.argv.slice(2);
  assertSafeDbTarget(process.env);
  const sql = postgres(process.env.DATABASE_URL!, {
    max: 1,
    onnotice: () => {},
  });
  try {
    if (command === "up") {
      const done = await migrateUp(sql, DIR);
      console.log(
        done.length ? `Applied: ${done.join(", ")}` : "Nothing to apply.",
      );
    } else if (command === "down") {
      const steps = arg ? Number(arg) : 1;
      const done = await migrateDown(sql, DIR, steps);
      console.log(
        done.length ? `Reverted: ${done.join(", ")}` : "Nothing to revert.",
      );
    } else if (command === "status") {
      const applied = new Set(await appliedVersions(sql));
      for (const m of loadMigrations(DIR)) {
        console.log(
          `${applied.has(m.version) ? "[x]" : "[ ]"} ${m.version}_${m.name}`,
        );
      }
    } else {
      throw new Error(
        `Unknown command "${command}". Use up, down [steps], or status.`,
      );
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
