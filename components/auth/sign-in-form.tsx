"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signInWithGoogle, signInWithPassword } from "@/lib/auth/actions";
import { callbackErrorMessage, type FormResult } from "@/lib/auth/forms";
import { Field, FormMessage, SubmitButton } from "./form-bits";

export function SignInForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const linkError = callbackErrorMessage(params.get("error"));
  const [result, action, pending] = useActionState<FormResult, FormData>(
    signInWithPassword,
    linkError ? { error: linkError } : {},
  );

  return (
    <div className="flex flex-col gap-section">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="h-tap w-full rounded-control border border-border bg-surface px-4 font-semibold"
        >
          Sign in with Google
        </button>
      </form>
      <p className="text-center text-xs text-ink-muted">or use your email</p>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        <FormMessage result={result} />
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>
      <Link href="/forgot-password" className="text-sm text-primary">
        Forgot your password?
      </Link>
    </div>
  );
}
