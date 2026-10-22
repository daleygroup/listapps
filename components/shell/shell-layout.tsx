import { Suspense, type ReactNode } from "react";
import { EMPTY_SHELL_VIEW } from "@/lib/services/shell-source";
import { AppShell, ShellHeader } from "./app-shell";
import { CurrentShellHeader } from "./current-shell-header";
import { ImpersonationBanner } from "./impersonation-banner";

/** The shared shell for platform and app pages. */
export function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      banner={
        <Suspense fallback={null}>
          <ImpersonationBanner />
        </Suspense>
      }
      header={
        <Suspense fallback={<ShellHeader view={EMPTY_SHELL_VIEW} />}>
          <CurrentShellHeader />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
