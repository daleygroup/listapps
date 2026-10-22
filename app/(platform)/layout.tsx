import { ShellLayout } from "@/components/shell/shell-layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ShellLayout>{children}</ShellLayout>;
}
