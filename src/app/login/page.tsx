"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, login } from "@/lib/api-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pin) {
      setError("Enter the PIN");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(pin);
      const next = searchParams.get("next") ?? "/";
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-paper-line bg-paper p-6 shadow-[0_12px_32px_var(--color-paper-shadow)]"
    >
      <label
        htmlFor="pin"
        className="block font-mono text-xs uppercase tracking-wider text-paper-ink-muted"
      >
        Household PIN
      </label>
      <input
        id="pin"
        name="pin"
        type="password"
        inputMode="text"
        autoComplete="current-password"
        autoFocus
        value={pin}
        onChange={(e) => {
          setPin(e.target.value);
          if (error) setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "pin-error" : undefined}
        className="mt-2 w-full rounded border border-paper-line bg-paper-raised px-3 py-2.5 font-mono text-lg tracking-[0.3em] text-paper-ink outline-none focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        placeholder="••••"
      />
      {error && (
        <p id="pin-error" role="alert" className="mt-2 text-sm font-medium text-must-ink">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded bg-blueprint-bg py-2.5 font-medium text-blueprint-ink transition-colors hover:bg-blueprint-bg-raised disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
      >
        {submitting ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="blueprint-canvas flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-blueprint-ink">
            The House List
          </h1>
          <p className="mt-1 text-sm text-blueprint-ink-muted">
            Shared renovation wishlist &amp; budget tracker
          </p>
        </div>

        <Suspense
          fallback={
            <div className="h-[186px] animate-pulse rounded-md border border-paper-line bg-paper" />
          }
        >
          <LoginForm />
        </Suspense>

        <p className="mt-4 text-center text-xs text-blueprint-ink-faint">
          Ask whoever set this up for the shared PIN.
        </p>
      </div>
    </main>
  );
}
