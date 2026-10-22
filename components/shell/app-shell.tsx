import Link from "next/link";
import type { ReactNode } from "react";
import type { ShellView } from "@/lib/services/app-shell";
import { AppSwitcher } from "./app-switcher";

export function AppShell({
  header,
  banner,
  children,
}: {
  /** The header, usually `<ShellHeader>` inside a Suspense boundary. */
  header: ReactNode;
  /** The impersonation banner slot; stays pinned above the header. */
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="sticky top-0 z-30">
        {banner}
        {header}
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export function ShellHeader({ view }: { view: ShellView }) {
  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-gutter">
      <div className="min-w-0">
        <Link href="/" className="block text-base font-semibold leading-tight">
          ListApps
        </Link>
        {view.accountName ? (
          <p className="truncate text-xs text-ink-muted">{view.accountName}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <AppSwitcher apps={view.apps} />
        <Link
          href="/settings"
          aria-label={
            view.userName ? `Settings for ${view.userName}` : "Settings"
          }
          className="flex h-tap w-tap items-center justify-center rounded-pill bg-surface-muted text-sm font-semibold"
        >
          {initials(view.userName)}
        </Link>
      </div>
    </header>
  );
}

function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
