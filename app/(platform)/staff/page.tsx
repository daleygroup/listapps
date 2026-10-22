import { Suspense } from "react";
import { StaffSection } from "@/components/staff/staff-section";

export default function StaffPage() {
  return (
    <main className="flex flex-col gap-section px-gutter py-section">
      <h1 className="text-2xl font-semibold">Staff tools</h1>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <StaffSection />
      </Suspense>
    </main>
  );
}
