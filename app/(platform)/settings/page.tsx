import { Suspense } from "react";
import { HandOffsSection } from "@/components/settings/hand-offs-section";
import { PeopleSection } from "@/components/settings/people-section";

export default function SettingsPage() {
  return (
    <main className="flex flex-col gap-section px-gutter py-section">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section aria-labelledby="people-heading" className="flex flex-col gap-3">
        <h2 id="people-heading" className="text-lg font-semibold">
          People
        </h2>
        <Suspense fallback={<p className="text-ink-muted">Loading people…</p>}>
          <PeopleSection />
        </Suspense>
      </section>
      <section
        aria-labelledby="hand-offs-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="hand-offs-heading" className="text-lg font-semibold">
          Hand-offs
        </h2>
        <Suspense
          fallback={<p className="text-ink-muted">Loading hand-offs…</p>}
        >
          <HandOffsSection />
        </Suspense>
      </section>
    </main>
  );
}
