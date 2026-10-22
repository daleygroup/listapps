"use client";

import { useActionState } from "react";
import type { FormResult } from "@/lib/auth/forms";
import {
  acceptDefaultsAction,
  reassignAction,
  removeMemberAction,
} from "@/lib/services/offboarding-actions";
import { FormMessage } from "@/components/auth/form-bits";

/**
 * Remove someone from an office or team. Tucked behind a disclosure and a
 * confirm box so it is never one accidental tap. Removal ends access at once;
 * nothing they own is deleted.
 */
export function RemoveMemberForm({
  membershipId,
  name,
  accountName,
}: {
  membershipId: string;
  name: string;
  accountName: string;
}) {
  const [result, action, pending] = useActionState<FormResult, FormData>(
    removeMemberAction,
    {},
  );
  if (result.notice) return <FormMessage result={result} />;
  return (
    <details className="mt-2 text-sm">
      <summary className="flex min-h-tap cursor-pointer items-center text-danger">
        Remove from {accountName}
      </summary>
      <form action={action} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="membershipId" value={membershipId} />
        <p className="text-ink-muted">
          {name} loses access to {accountName} immediately. Nothing is deleted:
          anything they held here goes on a hand-off list, and everything that
          is personally theirs stays with them.
        </p>
        <label className="flex flex-col gap-1 font-medium">
          Reason (optional, kept in the history)
          <input
            name="reason"
            type="text"
            maxLength={500}
            className="h-tap rounded-control border border-border bg-surface px-3 text-base text-ink"
          />
        </label>
        <label className="flex min-h-tap items-center gap-3 font-medium">
          <input
            type="checkbox"
            name="confirm"
            value="yes"
            required
            className="size-5"
          />
          Yes, remove {name}
        </label>
        <FormMessage result={result} />
        <button
          type="submit"
          disabled={pending}
          className="h-tap rounded-control bg-danger px-4 font-semibold text-primary-ink disabled:opacity-60"
        >
          {pending ? "One moment..." : "Remove now"}
        </button>
      </form>
    </details>
  );
}

export function AcceptDefaultsForm({
  membershipId,
  count,
}: {
  membershipId: string;
  count: number;
}) {
  const [result, action, pending] = useActionState<FormResult, FormData>(
    acceptDefaultsAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <FormMessage result={result} />
      <button
        type="submit"
        disabled={pending}
        className="h-tap rounded-control bg-primary px-4 font-semibold text-primary-ink disabled:opacity-60"
      >
        {pending
          ? "One moment..."
          : `Accept ${count === 1 ? "the default" : `all ${count} defaults`}`}
      </button>
    </form>
  );
}

export function ReassignForm({
  transferId,
  candidates,
}: {
  transferId: string;
  candidates: { userId: string; name: string }[];
}) {
  const [result, action, pending] = useActionState<FormResult, FormData>(
    reassignAction,
    {},
  );
  if (candidates.length === 0) return null;
  return (
    <form action={action} className="mt-2 flex flex-col gap-2 text-sm">
      <input type="hidden" name="transferId" value={transferId} />
      <label className="flex flex-col gap-1 font-medium">
        Give to someone else
        <select
          name="toUserId"
          required
          defaultValue=""
          className="h-tap rounded-control border border-border bg-surface px-3 text-base text-ink"
        >
          <option value="" disabled>
            Choose a person
          </option>
          {candidates.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <FormMessage result={result} />
      <button
        type="submit"
        disabled={pending}
        className="h-tap rounded-control border border-border bg-surface px-4 font-semibold text-ink disabled:opacity-60"
      >
        {pending ? "One moment..." : "Reassign"}
      </button>
    </form>
  );
}
