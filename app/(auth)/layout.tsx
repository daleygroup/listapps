import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center px-gutter py-section">
      <div className="flex w-full max-w-sm flex-col gap-section">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          ListApps
        </Link>
        {children}
      </div>
    </main>
  );
}
