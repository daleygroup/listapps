import type { AccountNode } from "./types";

/**
 * In-memory view of the account tree. One tree-walk implementation, reused by
 * theme, brand kit, settings, permission, and entitlement resolution
 * (CLAUDE.md section 4, Theming: "Build that tree-walk resolver once").
 */
export class AccountTree {
  private readonly nodes: Map<string, AccountNode>;

  constructor(accounts: Iterable<AccountNode>) {
    this.nodes = new Map();
    for (const a of accounts) {
      if (this.nodes.has(a.id)) throw new Error(`Duplicate account id ${a.id}`);
      this.nodes.set(a.id, a);
    }
    for (const a of this.nodes.values()) {
      if (a.parentId !== null && !this.nodes.has(a.parentId)) {
        throw new Error(`Account ${a.id} has unknown parent ${a.parentId}`);
      }
    }
    // Reject cycles up front so every walk below is guaranteed to end.
    for (const a of this.nodes.values()) this.ancestorsOf(a.id);
  }

  get(id: string): AccountNode {
    const node = this.nodes.get(id);
    if (!node) throw new Error(`Unknown account ${id}`);
    return node;
  }

  has(id: string): boolean {
    return this.nodes.has(id);
  }

  /** The account itself first, then its parent, up to the root. */
  ancestorsOf(id: string): AccountNode[] {
    const chain: AccountNode[] = [];
    const seen = new Set<string>();
    let current: AccountNode | undefined = this.get(id);
    while (current) {
      if (seen.has(current.id)) {
        throw new Error(`Account tree has a cycle at ${current.id}`);
      }
      seen.add(current.id);
      chain.push(current);
      current = current.parentId ? this.nodes.get(current.parentId) : undefined;
    }
    return chain;
  }

  /** True if `id` is `ancestorId` itself or anywhere beneath it. */
  isAtOrBelow(id: string, ancestorId: string): boolean {
    return this.ancestorsOf(id).some((a) => a.id === ancestorId);
  }
}

/**
 * Walks up from `accountId` and returns the first value that is set
 * (not undefined or null). Falls back to `fallback` (e.g. platform_theme).
 */
export function resolveInherited<T>(
  tree: AccountTree,
  accountId: string,
  valueAt: (accountId: string) => T | null | undefined,
  fallback?: T,
): T | undefined {
  for (const node of tree.ancestorsOf(accountId)) {
    const v = valueAt(node.id);
    if (v !== undefined && v !== null) return v;
  }
  return fallback;
}

/**
 * Field-by-field inheritance for token maps (theme overrides): each key comes
 * from the nearest account that sets it, else from `base`.
 */
export function resolveMerged<T extends Record<string, unknown>>(
  tree: AccountTree,
  accountId: string,
  overridesAt: (accountId: string) => Partial<T> | null | undefined,
  base: T,
): T {
  const result: Record<string, unknown> = { ...base };
  const chain = tree.ancestorsOf(accountId).reverse(); // root first, nearest last wins
  for (const node of chain) {
    const o = overridesAt(node.id);
    if (!o) continue;
    for (const [k, v] of Object.entries(o)) {
      if (v !== undefined && v !== null) result[k] = v;
    }
  }
  return result as T;
}
