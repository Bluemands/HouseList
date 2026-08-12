"use client";

import { FormEvent, useState } from "react";
import { Pencil } from "lucide-react";
import { formatGBP } from "@/lib/format";

type BudgetBarProps = {
  budgetAvailable: number;
  mustHaveOutstanding: number;
  wouldLikeOutstanding: number;
  somedayOutstanding: number;
  boughtActualTotal: number;
  onSaveBudget: (value: number) => Promise<void>;
};

export function BudgetBar({
  budgetAvailable,
  mustHaveOutstanding,
  wouldLikeOutstanding,
  somedayOutstanding,
  boughtActualTotal,
  onSaveBudget,
}: BudgetBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(budgetAvailable));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const remainder = budgetAvailable - mustHaveOutstanding;
  const overspend = remainder < 0;
  const pct = budgetAvailable > 0 ? Math.min(100, (mustHaveOutstanding / budgetAvailable) * 100) : mustHaveOutstanding > 0 ? 100 : 0;

  // Fill uses the saturated brand color (large area, clears the 3:1 non-text
  // threshold against the track). The label sitting on the navy surface
  // needs a lighter, text-safe red to clear 4.5:1 when overspent.
  const barColor = overspend
    ? "var(--color-must)"
    : pct >= 85
      ? "var(--color-like)"
      : "var(--color-good)";
  const barTextColor = overspend
    ? "var(--color-must-bright)"
    : pct >= 85
      ? "var(--color-like)"
      : "var(--color-good)";

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(draft);
    if (draft.trim() === "" || Number.isNaN(parsed) || parsed < 0) {
      setError("Enter a budget of 0 or more");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSaveBudget(parsed);
      setEditing(false);
    } catch {
      setError("Couldn't save — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-label="Budget summary"
      className="rounded-md border border-blueprint-border bg-blueprint-bg-raised/60 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blueprint-ink-faint">
            Budget available now
          </p>
          {editing ? (
            <form onSubmit={handleSave} className="mt-1 flex items-center gap-2">
              <span className="font-mono text-2xl text-blueprint-ink-muted">£</span>
              <input
                autoFocus
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Budget available now"
                aria-invalid={error ? true : undefined}
                className="w-28 rounded border border-blueprint-border bg-blueprint-bg px-2 py-1 font-mono text-2xl text-blueprint-ink outline-none focus-visible:ring-2 focus-visible:ring-someday"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded bg-someday px-3 py-1.5 text-sm font-medium text-someday-ink transition-colors hover:bg-someday/90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="rounded px-2.5 py-1.5 text-sm text-blueprint-ink-muted hover:text-blueprint-ink"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(String(budgetAvailable));
                setEditing(true);
              }}
              className="group mt-1 flex items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
            >
              <span className="font-tabular font-mono text-2xl text-blueprint-ink">
                {formatGBP(budgetAvailable)}
              </span>
              <Pencil
                size={14}
                strokeWidth={2}
                className="text-blueprint-ink-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                aria-hidden="true"
              />
              <span className="sr-only">Edit budget available</span>
            </button>
          )}
          {error && (
            <p role="alert" className="mt-1 text-xs font-medium text-must-bright">
              {error}
            </p>
          )}
        </div>

        <div className="text-right">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-blueprint-ink-faint">
            Must have, not yet bought
          </p>
          <p className="font-tabular mt-1 font-mono text-2xl text-blueprint-ink">
            {formatGBP(mustHaveOutstanding)}
          </p>
        </div>
      </div>

      {/* Dimension-line style budget bar */}
      <div className="relative mt-5 pb-6">
        <div className="relative h-3 w-full overflow-hidden rounded-sm border border-blueprint-border bg-blueprint-bg-inset">
          <div
            className="h-full transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%`, backgroundColor: barColor }}
          />
          {[25, 50, 75].map((mark) => (
            <span
              key={mark}
              className="absolute top-0 bottom-0 w-px bg-blueprint-bg/40"
              style={{ left: `${mark}%` }}
              aria-hidden="true"
            />
          ))}
        </div>
        {/* end-cap ticks, dimension-line style */}
        <span className="absolute -top-1 left-0 h-5 w-px bg-blueprint-border" aria-hidden="true" />
        <span className="absolute -top-1 right-0 h-5 w-px bg-blueprint-border" aria-hidden="true" />

        {!overspend && (
          <p
            className="font-tabular absolute top-6 font-mono text-xs"
            style={{
              left: `${Math.min(Math.max(pct, 6), 94)}%`,
              transform: "translateX(-50%)",
              color: barTextColor,
            }}
          >
            {pct.toFixed(0)}%
          </p>
        )}

        <p
          role="status"
          className={`font-tabular absolute top-6 right-0 font-mono text-sm font-medium ${
            overspend ? "text-must-bright" : "text-good"
          }`}
        >
          {overspend
            ? `${formatGBP(Math.abs(remainder))} over budget`
            : `${formatGBP(remainder)} remaining`}
        </p>
      </div>

      <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2 border-t border-blueprint-border pt-3 font-mono text-xs text-blueprint-ink-muted">
        <div className="flex items-baseline gap-1.5">
          <dt className="uppercase tracking-wider text-blueprint-ink-faint">Would like</dt>
          <dd className="font-tabular text-blueprint-ink">{formatGBP(wouldLikeOutstanding)}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="uppercase tracking-wider text-blueprint-ink-faint">Someday</dt>
          <dd className="font-tabular text-blueprint-ink">{formatGBP(somedayOutstanding)}</dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="uppercase tracking-wider text-blueprint-ink-faint">
            All tiers outstanding
          </dt>
          <dd className="font-tabular text-blueprint-ink">
            {formatGBP(mustHaveOutstanding + wouldLikeOutstanding + somedayOutstanding)}
          </dd>
        </div>
        <div className="ml-auto flex items-baseline gap-1.5">
          <dt className="uppercase tracking-wider text-blueprint-ink-faint">Actually spent</dt>
          <dd className="font-tabular text-good">{formatGBP(boughtActualTotal)}</dd>
        </div>
      </dl>
    </section>
  );
}
