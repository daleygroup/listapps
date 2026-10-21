import type { Sql, TransactionSql } from "postgres";

/**
 * Runs `fn` in a transaction as a signed-in user, exactly as Supabase would:
 * role `authenticated`, the user's id as the JWT subject. Row Level Security
 * applies to everything inside. Commits on success.
 *
 * Use this for every customer-initiated write so the database enforces the
 * same rules the service layer already checked (CLAUDE.md section 3: both).
 */
export async function withUser<T>(
  sql: Sql,
  userId: string,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  return (await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`;
    await tx.unsafe("set local role authenticated");
    return fn(tx);
  })) as T;
}
