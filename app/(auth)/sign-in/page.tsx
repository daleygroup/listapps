import { Suspense } from "react";
import { NotConfigured } from "@/components/auth/form-bits";
import { SignInForm } from "@/components/auth/sign-in-form";
import { authConfigFromProcess } from "@/lib/auth/config";

export const metadata = { title: "Sign in | ListApps" };

export default function SignInPage() {
  const configured = authConfigFromProcess().configured;
  return (
    <>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {configured ? (
        <Suspense
          fallback={<p className="text-sm text-ink-muted">Loading...</p>}
        >
          <SignInForm />
        </Suspense>
      ) : (
        <NotConfigured />
      )}
    </>
  );
}
