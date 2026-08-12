"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ItemDTO } from "@/lib/types";
import { formatGBP } from "@/lib/format";

type MarkBoughtDialogProps = {
  item: ItemDTO | null;
  busy?: boolean;
  onConfirm: (actualPrice: number) => void;
  onCancel: () => void;
};

export function MarkBoughtDialog({ item, busy = false, onConfirm, onCancel }: MarkBoughtDialogProps) {
  const [value, setValue] = useState(() => String(item?.estimatedPrice ?? ""));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    if (item) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [item, onCancel]);

  if (!item) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(value);
    if (value.trim() === "" || Number.isNaN(parsed) || parsed <= 0) {
      setError("Enter what you actually paid — a number greater than 0");
      return;
    }
    onConfirm(parsed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-blueprint-bg-inset/80 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bought-title"
        className="w-full max-w-sm rounded-md border border-paper-line bg-paper p-5 shadow-[0_20px_48px_var(--color-paper-shadow)]"
      >
        <h2 id="bought-title" className="text-base font-semibold text-paper-ink">
          Mark &ldquo;{item.title}&rdquo; as bought
        </h2>
        <p className="mt-1 text-sm text-paper-ink-muted">
          Estimated at {formatGBP(item.estimatedPrice, true)}. What did it actually cost?
        </p>

        <label htmlFor="actual-price" className="mt-4 block font-mono text-xs uppercase tracking-wider text-paper-ink-muted">
          Actual price paid (GBP)
        </label>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono text-lg text-paper-ink-muted">£</span>
          <input
            id="actual-price"
            autoFocus
            type="number"
            min={0.01}
            step="0.01"
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "actual-price-error" : undefined}
            className="w-full rounded border border-paper-line bg-paper-raised px-3 py-2 font-mono text-lg text-paper-ink outline-none focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          />
        </div>
        {error && (
          <p id="actual-price-error" role="alert" className="mt-2 text-sm font-medium text-must-ink">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-paper-line px-3.5 py-2 text-sm font-medium text-paper-ink-muted transition-colors hover:bg-blueprint-bg/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-good-solid px-3.5 py-2 text-sm font-medium text-good-ink transition-colors hover:bg-good-solid/90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
          >
            {busy ? "Saving…" : "Confirm bought"}
          </button>
        </div>
      </form>
    </div>
  );
}
