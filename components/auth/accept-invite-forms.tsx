"use client";

import { useActionState } from "react";
import {
  acceptInviteAction,
  createAccountAndAcceptAction,
} from "@/lib/auth/invite-actions";
import { MIN_PASSWORD_LENGTH, type FormResult } from "@/lib/auth/forms";
import { ACK_VALUE } from "@/lib/auth/invite-view";
import { Field, FormMessage, SubmitButton } from "./form-bits";

/**
 * Shown when the account has a contact policy (CLAUDE.md section 4: disclosed
 * when the agent accepts). The policy wording itself is D-007; the promise in
 * the second sentence is not configurable.
 */
function ContactPolicy({
  accountName,
  policy,
}: {
  accountName: string;
  policy: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface-muted p-4 text-sm">
      <p className="font-semibold">How {accountName} handles contacts</p>
      <p>{policy}</p>
      <p className="text-ink-muted">
        Whatever this says, every contact you own stays yours if you ever leave.
      </p>
      <label className="flex min-h-tap items-center gap-3 font-medium">
        <input
          type="checkbox"
          name="ack"
          value={ACK_VALUE}
          required
          className="size-5"
        />
        I have read this
      </label>
    </div>
  );
}

type FormProps = {
  token: string;
  accountName: string;
  contactPolicy: string | null;
};

export function AcceptInviteForm({
  token,
  accountName,
  contactPolicy,
}: FormProps) {
  const [result, action, pending] = useActionState<FormResult, FormData>(
    acceptInviteAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {contactPolicy ? (
        <ContactPolicy accountName={accountName} policy={contactPolicy} />
      ) : null}
      <FormMessage result={result} />
      <SubmitButton pending={pending}>Join {accountName}</SubmitButton>
    </form>
  );
}

export function CreateAccountForm({
  token,
  accountName,
  contactPolicy,
}: FormProps) {
  const [result, action, pending] = useActionState<FormResult, FormData>(
    createAccountAndAcceptAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Field
        label={`Choose a password (at least ${MIN_PASSWORD_LENGTH} characters)`}
        name="password"
        type="password"
        autoComplete="new-password"
      />
      <Field
        label="Type it again"
        name="confirm"
        type="password"
        autoComplete="new-password"
      />
      {contactPolicy ? (
        <ContactPolicy accountName={accountName} policy={contactPolicy} />
      ) : null}
      <FormMessage result={result} />
      <SubmitButton pending={pending}>Create my sign-in and join</SubmitButton>
    </form>
  );
}
