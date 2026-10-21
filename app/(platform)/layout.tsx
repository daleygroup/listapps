import { AppShell } from "@/components/shell/app-shell";
import { getCurrentShellView } from "@/lib/services/current-shell";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell view={getCurrentShellView()}>{children}</AppShell>;
}
