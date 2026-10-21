"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import type { ShellApp } from "@/lib/services/app-shell";

/**
 * Mobile-first app switcher. A native <details> panel, so it opens without
 * JavaScript and works with one thumb; JS only closes it after navigation and
 * marks the current app.
 */
export function AppSwitcher({ apps }: { apps: ShellApp[] }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);
  const current = apps.find(
    (a) => pathname === a.href || pathname.startsWith(`${a.href}/`),
  );

  return (
    <details ref={ref} className="group relative">
      <summary
        className="flex min-h-tap cursor-pointer list-none items-center gap-2 rounded-control border border-border px-3 text-sm font-medium [&::-webkit-details-marker]:hidden"
        aria-label="Switch app"
      >
        <span aria-hidden className="grid grid-cols-2 gap-0.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className="block h-1.5 w-1.5 rounded-pill bg-ink-muted"
            />
          ))}
        </span>
        <span>{current?.name ?? "Apps"}</span>
      </summary>

      <nav
        aria-label="Applications"
        className="fixed inset-x-0 top-14 z-20 border-b border-border bg-surface p-gutter shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 sm:rounded-card sm:border"
      >
        {apps.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No apps are turned on for your account yet.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {apps.map((app) => {
              const active = app.slug === current?.slug;
              return (
                <li key={app.slug}>
                  <Link
                    href={app.href}
                    onClick={() => ref.current?.removeAttribute("open")}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-tap items-center justify-center rounded-control border px-3 text-sm font-medium ${
                      active
                        ? "border-primary bg-primary text-primary-ink"
                        : "border-border bg-surface-muted text-ink"
                    }`}
                  >
                    {app.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </details>
  );
}
