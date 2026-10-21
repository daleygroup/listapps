import { readFileSync } from "node:fs";
import path from "node:path";
import type { Sql, TransactionSql } from "postgres";

const AUTH_STUB = path.resolve(__dirname, "../../../db/testing/auth-stub.sql");

/** Installs the local auth stub (auth.uid(), roles). Test databases only. */
export async function installAuthStub(sql: Sql): Promise<void> {
  await sql.unsafe(readFileSync(AUTH_STUB, "utf8"));
}

/**
 * Runs `fn` as a signed-in user, the way Supabase does: role `authenticated`
 * with the user's id as the JWT subject. Rolled back afterwards so tests
 * cannot leak writes into each other.
 */
export async function asUser<T>(
  sql: Sql,
  userId: string,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  let result!: T;
  await sql
    .begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;
      await tx.unsafe("set local role authenticated");
      result = await fn(tx);
      throw new RollbackSignal();
    })
    .catch((err) => {
      if (!(err instanceof RollbackSignal)) throw err;
    });
  return result;
}

class RollbackSignal extends Error {}
