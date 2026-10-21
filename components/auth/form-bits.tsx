import type { FormResult } from "@/lib/auth/forms";

export function Field({
  label,
  name,
  type,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className="h-tap rounded-control border border-border bg-surface px-3 text-base text-ink"
      />
    </label>
  );
}

export function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-tap rounded-control bg-primary px-4 font-semibold text-primary-ink disabled:opacity-60"
    >
      {pending ? "One moment..." : children}
    </button>
  );
}

export function FormMessage({ result }: { result: FormResult }) {
  if (result.error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {result.error}
      </p>
    );
  }
  if (result.notice) {
    return (
      <p role="status" className="text-sm text-success">
        {result.notice}
      </p>
    );
  }
  return null;
}

export function NotConfigured() {
  return (
    <p className="rounded-card bg-surface-muted p-4 text-sm text-ink-muted">
      Sign-in is not set up yet on this copy of ListApps.
    </p>
  );
}
