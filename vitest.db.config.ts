import { defineConfig } from "vitest/config";
import path from "node:path";

// Database tests: start a throwaway local Postgres per file. Never a hosted database.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    include: ["**/*.db.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
