"use client";

import { useActionState } from "react";
import { setNewPassword } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH, type FormResult } from "@/lib/auth/forms";
import { Field, FormMessage, SubmitButton } from "./form-bits";

export function ResetPasswordForm() {
  const [result, action, pending] = useActionState<FormResult, FormData>(
    setNewPassword,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field
        label={`New password (at least ${MIN_PASSWORD_LENGTH} characters)`}
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
      <FormMessage result={result} />
      <SubmitButton pending={pending}>Save new password</SubmitButton>
    </form>
  );
}
