import { NotConfigured } from "@/components/auth/form-bits";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { authConfigFromProcess } from "@/lib/auth/config";

export const metadata = { title: "Reset your password | ListApps" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      {authConfigFromProcess().configured ? (
        <ForgotPasswordForm />
      ) : (
        <NotConfigured />
      )}
    </>
  );
}
