"use server";

import { revalidatePath } from "next/cache";
import type { FormResult } from "@/lib/auth/forms";
import { getAuthUser } from "@/lib/auth/supabase-server";
import { getServerSql } from "@/lib/db/server";
import {
  acceptDefaults,
  OffboardingError,
  reassignTransfer,
  removeMembership,
} from "./offboarding";

/**
 * Settings actions for removing someone and handing off what they held.
 * Who is acting comes only from the verified session; the services re-check
 * permission and the database's Row Level Security enforces it again.
 */
type ActionResult = FormResult;

const NOT_SET_UP: ActionResult = {
  error: "Sign-in is not set up yet on this copy of ListApps.",
};

function field(form: FormData, name: string): string | null {
  const v = form.get(name);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function actor() {
  const sql = getServerSql();
  const user = sql ? await getAuthUser() : null;
  return sql && user ? { sql, userId: user.id } : null;
}

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    const notice = await fn();
    revalidatePath("/settings");
    return { notice };
  } catch (err) {
    if (err instanceof OffboardingError) return { error: err.message };
    throw err;
  }
}

export async function removeMemberAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const a = await actor();
  if (!a) return NOT_SET_UP;
  const membershipId = field(form, "membershipId");
  if (!membershipId) return { error: "Choose who to remove." };
  if (form.get("confirm") !== "yes") {
    return { error: "Tick the box to confirm the removal." };
  }
  return run(async () => {
    const r = await removeMembership(a.sql, {
      membershipId,
      actorUserId: a.userId,
      reason: field(form, "reason") ?? undefined,
    });
    return r.transferIds.length > 0
      ? "Removed. Their access ended now. Their hand-off list is below."
      : "Removed. Their access ended now. They held nothing to hand off.";
  });
}

export async function acceptDefaultsAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const a = await actor();
  if (!a) return NOT_SET_UP;
  const membershipId = field(form, "membershipId");
  if (!membershipId) return { error: "Nothing to accept." };
  return run(async () => {
    const n = await acceptDefaults(a.sql, {
      membershipId,
      actorUserId: a.userId,
    });
    return n === 0
      ? "Nothing left with a default to accept."
      : `Accepted ${n} item${n === 1 ? "" : "s"}.`;
  });
}

export async function reassignAction(
  _prev: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const a = await actor();
  if (!a) return NOT_SET_UP;
  const transferId = field(form, "transferId");
  const toUserId = field(form, "toUserId");
  if (!transferId || !toUserId) return { error: "Choose who takes this over." };
  return run(async () => {
    await reassignTransfer(a.sql, {
      transferId,
      toUserId,
      actorUserId: a.userId,
    });
    return "Reassigned.";
  });
}
