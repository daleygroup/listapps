"use client";

import { useActionState } from "react";
import type { FormResult } from "@/lib/auth/forms";
import {
  inviteMemberAction,
  resendInviteAction,
  withdrawInviteAction,
} from "@/lib/services/invitation-actions";
import { FormMessage } from "@/components/auth/form-bits";

const inputClass =
  "h-tap rounded-control border border-border bg-surface px-3 text-base text-ink";

/**
 * Invite someone into one office or team. The server decides whether the
 * signed-in person may invite here and at that role; this form only offers
 * the choice. The join link is emailed, never shown on screen (D-009).
 */
export function InviteForm({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const [result, action, pending] = useActionState<FormResult, FormData>(
    inviteMemberAction,
    {},
  );
  return (
    <details className="mt-3 text-sm">
      <summary className="flex min-h-tap cursor-pointer items-center font-semibold text-primary">
        Invite someone to {accountName}
      </summary>
      <form action={action} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="accountId" value={accountId} />
        <label className="flex flex-col gap-1 font-medium">
          Their email address
          <input
            name="email"
            type="email"
            autoComplete="off"
            inputMode="email"
            required
            maxLength={254}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 font-medium">
          Role
          <select name="role" defaultValue="member" className={inputClass}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <p className="text-ink-muted">
          They get a link that works once, only for this email address, for 7
          days. You can only invite someone at your own role or below.
        </p>
        <FormMessage result={result} />
        <button
          type="submit"
          disabled={pending}
          className="h-tap rounded-control bg-primary px-4 font-semibold text-primary-ink disabled:opacity-60"
        >
          {pending ? "One moment..." : "Send invitation"}
        </button>
      </form>
    </details>
  );
}

/** Resend (fresh link, old one stops working) or withdraw an open invitation. */
export function OpenInviteActions({
  membershipId,
  email,
}: {
  membershipId: string;
  email: string;
}) {
  const [resent, resend, resending] = useActionState<FormResult, FormData>(
    resendInviteAction,
    {},
  );
  const [withdrawn, withdraw, withdrawing] = useActionState<
    FormResult,
    FormData
  >(withdrawInviteAction, {});
  if (withdrawn.notice) return <FormMessage result={withdrawn} />;
  return (
    <div className="mt-2 flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap gap-3">
        <form action={resend}>
          <input type="hidden" name="membershipId" value={membershipId} />
          <button
            type="submit"
            disabled={resending || withdrawing}
            className="h-tap rounded-control border border-border px-4 font-semibold disabled:opacity-60"
          >
            {resending ? "One moment..." : "Resend"}
          </button>
        </form>
        <form action={withdraw}>
          <input type="hidden" name="membershipId" value={membershipId} />
          <button
            type="submit"
            disabled={resending || withdrawing}
            aria-label={`Withdraw the invitation to ${email}`}
            className="h-tap rounded-control border border-border px-4 font-semibold text-danger disabled:opacity-60"
          >
            {withdrawing ? "One moment..." : "Withdraw"}
          </button>
        </form>
      </div>
      <FormMessage result={resent} />
      <FormMessage result={withdrawn} />
    </div>
  );
}
