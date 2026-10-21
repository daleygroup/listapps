"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/auth/actions";
import type { FormResult } from "@/lib/auth/forms";
import { Field, FormMessage, SubmitButton } from "./form-bits";

export function ForgotPasswordForm() {
  const [result, action, pending] = useActionState<FormResult, FormData>(
    requestPasswordReset,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <FormMessage result={result} />
      <SubmitButton pending={pending}>Email me a reset link</SubmitButton>
    </form>
  );
}
