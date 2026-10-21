import type { Sql } from "postgres";

/**
 * Milestone 1 seed: the first tenant and a second, unrelated test brokerage.
 *
 * This is the ONLY place real customer names may appear (CLAUDE.md section 0).
 * Brokerage legal details (license numbers, qualifying broker, address) are
 * left empty and marked pending_review until Joseph supplies them.
 *
 * Idempotent: safe to run repeatedly. Never deletes anything.
 */
export const SEED = {
  franchise: {
    legalName: "Keller Williams Realty, Inc.",
    displayName: "Keller Williams",
  },
  brokerage: {
    slug: "kw-metro-south",
    name: "KW Metro South",
    legalName: "Keller Williams Realty Metro South",
    city: "Birmingham",
    state: "AL",
  },
  team: { slug: "the-daley-group", name: "The Daley Group" },
  testBrokerage: { slug: "test-brokerage-two", name: "Test Brokerage Two" },
} as const;

export interface SeedOptions {
  /**
   * Email of an existing login (they must have signed up first). If given,
   * that person becomes ListApps owner staff and owner of the team.
   */
  ownerEmail?: string;
}

export interface SeedResult {
  brokerageAccountId: string;
  teamAccountId: string;
  testBrokerageAccountId: string;
  ownerUserId: string | null;
}

export async function seedMilestone1(
  sql: Sql,
  opts: SeedOptions = {},
): Promise<SeedResult> {
  return sql.begin(async (tx) => {
    const franchiseId = await findOrCreateBrokerage(tx, {
      kind: "franchise",
      legal_name: SEED.franchise.legalName,
      display_name: SEED.franchise.displayName,
      franchise_id: null,
      city: null,
      state: null,
    });
    const officeId = await findOrCreateBrokerage(tx, {
      kind: "office",
      legal_name: SEED.brokerage.legalName,
      display_name: SEED.brokerage.name,
      franchise_id: franchiseId,
      city: SEED.brokerage.city,
      state: SEED.brokerage.state,
    });

    const brokerageAccountId = await findOrCreateAccount(tx, {
      slug: SEED.brokerage.slug,
      name: SEED.brokerage.name,
      account_type: "brokerage",
      parent_account_id: null,
      brokerage_id: officeId,
    });
    const teamAccountId = await findOrCreateAccount(tx, {
      slug: SEED.team.slug,
      name: SEED.team.name,
      account_type: "team",
      parent_account_id: brokerageAccountId,
      brokerage_id: null,
    });
    const testBrokerageAccountId = await findOrCreateAccount(tx, {
      slug: SEED.testBrokerage.slug,
      name: SEED.testBrokerage.name,
      account_type: "brokerage",
      parent_account_id: null,
      brokerage_id: null,
    });

    let ownerUserId: string | null = null;
    if (opts.ownerEmail) {
      const [owner] = await tx<{ id: string }[]>`
        select id from public.users where email = ${opts.ownerEmail}`;
      if (!owner) {
        throw new Error(
          `No login exists for ${opts.ownerEmail}. Sign up first, then rerun the seed.`,
        );
      }
      ownerUserId = owner.id;
      await tx`
        insert into public.platform_staff (user_id, staff_role, can_elevate_impersonation)
        values (${owner.id}, 'owner', true)
        on conflict (user_id) do nothing`;
      const existing = await tx`
        select 1 from public.account_memberships
        where account_id = ${teamAccountId} and user_id = ${owner.id} and status <> 'removed'`;
      if (existing.length === 0) {
        await tx`
          insert into public.account_memberships (account_id, user_id, role, status, joined_at)
          values (${teamAccountId}, ${owner.id}, 'owner', 'active', now())`;
      }
    }

    return {
      brokerageAccountId,
      teamAccountId,
      testBrokerageAccountId,
      ownerUserId,
    };
  });
}

type Tx = Parameters<Parameters<Sql["begin"]>[0]>[0];

async function findOrCreateBrokerage(
  tx: Tx,
  b: {
    kind: string;
    legal_name: string;
    display_name: string;
    franchise_id: string | null;
    city: string | null;
    state: string | null;
  },
): Promise<string> {
  const [found] = await tx<{ id: string }[]>`
    select id from public.brokerages where legal_name = ${b.legal_name} and kind = ${b.kind}`;
  if (found) return found.id;
  const [row] = await tx<{ id: string }[]>`
    insert into public.brokerages (kind, legal_name, display_name, franchise_id, city, state, status)
    values (${b.kind}, ${b.legal_name}, ${b.display_name}, ${b.franchise_id}, ${b.city}, ${b.state},
            'pending_review')
    returning id`;
  return row.id;
}

async function findOrCreateAccount(
  tx: Tx,
  a: {
    slug: string;
    name: string;
    account_type: string;
    parent_account_id: string | null;
    brokerage_id: string | null;
  },
): Promise<string> {
  const [found] = await tx<{ id: string }[]>`
    select id from public.accounts where slug = ${a.slug}`;
  if (found) return found.id;
  const [row] = await tx<{ id: string }[]>`
    insert into public.accounts (slug, name, account_type, parent_account_id, brokerage_id)
    values (${a.slug}, ${a.name}, ${a.account_type}, ${a.parent_account_id}, ${a.brokerage_id})
    returning id`;
  return row.id;
}
