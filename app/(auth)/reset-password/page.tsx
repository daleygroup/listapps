import { NotConfigured } from "@/components/auth/form-bits";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { authConfigFromProcess } from "@/lib/auth/config";

export const metadata = { title: "Choose a new password | ListApps" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      {authConfigFromProcess().configured ? (
        <ResetPasswordForm />
      ) : (
        <NotConfigured />
      )}
    </>
  );
}
