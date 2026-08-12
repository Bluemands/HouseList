"use client";

import { FormEvent, useState } from "react";

export function NameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Enter a name so items show who added them");
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-blueprint-bg-inset/90 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-gate-title"
        className="w-full max-w-sm rounded-md border border-paper-line bg-paper p-6 shadow-[0_20px_48px_var(--color-paper-shadow)]"
      >
        <h2 id="name-gate-title" className="text-lg font-semibold text-paper-ink">
          Who&apos;s using this?
        </h2>
        <p className="mt-1 text-sm text-paper-ink-muted">
          Remembered on this device so items show who added them.
        </p>

        <label htmlFor="display-name" className="mt-4 block font-mono text-xs uppercase tracking-wider text-paper-ink-muted">
          Your name
        </label>
        <input
          id="display-name"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "name-error" : undefined}
          maxLength={80}
          className="mt-2 w-full rounded border border-paper-line bg-paper-raised px-3 py-2.5 text-paper-ink outline-none focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          placeholder="e.g. Kerrigan"
        />
        {error && (
          <p id="name-error" role="alert" className="mt-2 text-sm font-medium text-must-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="mt-5 w-full rounded bg-blueprint-bg py-2.5 font-medium text-blueprint-ink transition-colors hover:bg-blueprint-bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
