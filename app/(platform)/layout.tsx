import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ImpersonationBanner } from "@/components/shell/impersonation-banner";
import { getCurrentShellView } from "@/lib/services/current-shell";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell
      view={getCurrentShellView()}
      banner={
        <Suspense fallback={null}>
          <ImpersonationBanner />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
