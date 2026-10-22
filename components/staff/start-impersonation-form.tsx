"use client";

import { useActionState } from "react";
import type { FormResult } from "@/lib/auth/forms";
import { startImpersonationAction } from "@/lib/services/staff-actions";
import { FormMessage, SubmitButton } from "@/components/auth/form-bits";

const INPUT =
  "h-tap rounded-control border border-border bg-surface px-3 text-base text-ink";

export function StartImpersonationForm() {
  const [result, action, pending] = useActionState<FormResult, FormData>(
    startImpersonationAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Their email address
        <input
          name="email"
          type="email"
          autoComplete="off"
          required
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Reason (kept in the log)
        <input
          name="reason"
          type="text"
          required
          maxLength={500}
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        How long
        <select name="minutes" defaultValue="60" className={INPUT}>
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="60">1 hour</option>
          <option value="120">2 hours</option>
        </select>
      </label>
      <FormMessage result={result} />
      <SubmitButton pending={pending}>Start view-only session</SubmitButton>
    </form>
  );
}
