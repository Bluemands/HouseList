"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, login } from "@/lib/api-client";
import { Button, inputClass } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";

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
      // Same-site paths only: "//host" and "/\host" would leave the app.
      const next = searchParams.get("next") ?? "/";
      router.replace(/^\/(?![/\\])/.test(next) ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <label htmlFor="pin" className="text-[13px] font-semibold text-ink-2">
        Household PIN
      </label>
      <input
        id="pin"
        name="pin"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={pin}
        onChange={(e) => {
          setPin(e.target.value);
          if (error) setError(null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "pin-error" : undefined}
        className={`${inputClass} text-[18px] tracking-[0.25em]`}
      />
      {error && (
        <p id="pin-error" role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={submitting} className="mt-1 py-3">
        {submitting ? "Checking…" : "Unlock"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-[360px]">
        <Wordmark className="mb-8" />
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.02em]">Welcome home</h1>
        <p className="mt-1 mb-6 text-[15px] text-ink-2">Jobs, buys and the budget for the house, shared between you.</p>
        <Suspense fallback={<div className="h-[150px]" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
