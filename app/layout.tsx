import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ListApps",
  description: "Tools for real estate professionals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-surface font-sans text-ink">
        {children}
      </body>
    </html>
  );
}
