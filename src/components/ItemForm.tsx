"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  ROOMS,
  ROOM_LABELS,
  STATUSES,
  STATUS_LABELS,
} from "@/lib/types";
import type { ItemDTO, Priority, Room, Status } from "@/lib/types";
import { PRIORITY_META } from "@/lib/priorityMeta";
import { ApiError } from "@/lib/api-client";

export type ItemFormValues = {
  title: string;
  room: Room;
  estimatedPrice: string;
  priority: Priority;
  link: string;
  notes: string;
  addedBy: string;
  status: Status;
  actualPrice: string;
};

type ItemFormProps = {
  open: boolean;
  mode: "add" | "edit";
  initial?: ItemDTO;
  defaultAddedBy?: string;
  onSubmit: (values: ItemFormValues) => Promise<void>;
  onCancel: () => void;
};

function toValues(mode: "add" | "edit", initial: ItemDTO | undefined, defaultAddedBy: string): ItemFormValues {
  if (mode === "edit" && initial) {
    return {
      title: initial.title,
      room: initial.room,
      estimatedPrice: String(initial.estimatedPrice),
      priority: initial.priority,
      link: initial.link ?? "",
      notes: initial.notes ?? "",
      addedBy: initial.addedBy,
      status: initial.status,
      actualPrice: initial.actualPrice != null ? String(initial.actualPrice) : "",
    };
  }
  return {
    title: "",
    room: "KITCHEN",
    estimatedPrice: "",
    priority: "MUST_HAVE",
    link: "",
    notes: "",
    addedBy: defaultAddedBy,
    status: "WISHLIST",
    actualPrice: "",
  };
}

type FieldErrors = Partial<Record<keyof ItemFormValues, string>>;

function validate(values: ItemFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.title.trim()) {
    errors.title = "Title is required";
  } else if (values.title.trim().length > 200) {
    errors.title = "Keep the title under 200 characters";
  }

  const price = Number(values.estimatedPrice);
  if (values.estimatedPrice.trim() === "" || Number.isNaN(price)) {
    errors.estimatedPrice = "Enter a valid number";
  } else if (price <= 0) {
    errors.estimatedPrice = "Price must be greater than 0";
  }

  if (values.link.trim()) {
    try {
      new URL(values.link.trim());
    } catch {
      errors.link = "Enter a valid URL, e.g. https://example.com";
    }
  }

  if (!values.addedBy.trim()) {
    errors.addedBy = "Missing name";
  }

  if (values.actualPrice.trim()) {
    const actual = Number(values.actualPrice);
    if (Number.isNaN(actual) || actual <= 0) {
      errors.actualPrice = "Price must be greater than 0";
    }
  }

  return errors;
}

export function ItemForm({ open, mode, initial, defaultAddedBy = "", onSubmit, onCancel }: ItemFormProps) {
  const [values, setValues] = useState<ItemFormValues>(() => toValues(mode, initial, defaultAddedBy));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const headingId = useId();

  useEffect(() => {
    // Runs once per mount — the parent keys this component by
    // mode+item id, so a fresh instance (and a focus call) is what we get
    // each time the form opens for a different item or a new one.
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  function setField<K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const fieldErrors = validate(values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        const mapped: FieldErrors = {};
        for (const [key, msgs] of Object.entries(err.fieldErrors)) {
          if (msgs?.[0]) mapped[key as keyof ItemFormValues] = msgs[0];
        }
        setErrors(mapped);
      }
      setSubmitError(err instanceof ApiError ? err.message : "Something went wrong — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-blueprint-bg-inset/80 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-lg border border-paper-line bg-paper shadow-[0_-8px_40px_var(--color-paper-shadow)] sm:rounded-md sm:shadow-[0_20px_48px_var(--color-paper-shadow)]"
      >
        <div className="flex items-center justify-between border-b border-paper-line px-5 py-4">
          <h2 id={headingId} className="text-lg font-semibold text-paper-ink">
            {mode === "add" ? "Add item" : "Edit item"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="rounded p-1 text-paper-ink-muted hover:text-paper-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label htmlFor="title" className="block font-mono text-xs uppercase tracking-wider text-paper-ink-muted">
              Title <span className="text-must-ink">*</span>
            </label>
            <input
              ref={titleRef}
              id="title"
              value={values.title}
              onChange={(e) => setField("title", e.target.value)}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "title-error" : undefined}
              maxLength={200}
              className="mt-1.5 w-full rounded border border-paper-line bg-paper-raised px-3 py-2 text-paper-ink outline-none focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              placeholder="e.g. Induction hob"
            />
            {errors.title && (
              <p id="title-error" role="alert" className="mt-1 text-sm font-medium text-must-ink">
                {errors.title}
              </p>
            )}
          </div>

          <fieldset>
            <legend className="block font-mono text-xs uppercase tracking-wider text-paper-ink-muted">
              Priority <span className="text-must-ink">*</span>
            </legend>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {PRIORITIES.map((p) => {
                const meta = PRIORITY_META[p];
                const active = values.priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setField("priority", p)}
                    className={`rounded border px-2 py-2 text-center text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday ${
                      active
                        ? `${meta.solid} ${meta.onSolid} border-transparent`
                        : "border-paper-line text-paper-ink-muted hover:bg-paper-raised"
                    }`}
                  >
                    {PRIORITY_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="room" className="block font-mono text-xs uppercase tracking-wider text-paper-ink-muted">
                Room
              </label>
              <select
                id="room"
                value={values.room}
                onChange={(e) => setField("room", e.target.value as Room)}
                className="mt-1.5 w-full rounded border border-paper-line bg-paper-raised px-3 py-2 text-paper-ink outline-none focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                {ROOMS.map((r) => (
                  <option key={r} value={r}>
                    {ROOM_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="estimatedPrice" className="block font-mono text-xs uppercase tracking-wider text-paper-ink-muted">
                Estimated price (GBP) <span className="text-must-ink">*</span>
              </label>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="font-mono text-paper-ink-muted">£</span>
                <input
                  id="estimatedPrice"
                  type="number"
                  min={0.01}
                  step="0.01"
                  inputMode="decimal"
                  value={values.estimatedPrice}
                  onChange={(e) => setField("estimatedPrice", e.target.value)}
                  aria-invalid={errors.estimatedPrice ? true : undefined}
                  aria-describedby={errors.estimatedPrice ? "price-error" : undefined}
                  className="w-full rounded border border-paper-line bg-paper-raised px-3 py-2 font-mono text-paper-ink outline-none focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                  placeholder="0.00"
                />
              </div>
              {errors.estimatedPrice && (
                <p id="price-error" role="alert" className="mt-1 text-sm font-medium text-must-ink">
                  {errors.estimatedPrice}
                </p>
              )}
            </div>
          </div>

          {mode === "edit" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="status" className="block font-mono text-xs uppercase tracking-wider text-paper-ink-muted">
                  Status
                </label>
                <select
                  id="status"
                  value={values.status}
                  onChange={(e) => setField("status", e.target.value as Status)}
                  className="mt-1.5 w-full rounded border border-paper-line bg-paper-raised px-3 py-2 text-paper-ink outline-none focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="actualPrice" className="block font-mono text-xs uppercase tracking-wider text-paper-ink-muted">
                  Actual price paid
                </label>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="font-mono text-paper-ink-muted">£</span>
                  <input
                    id="actualPrice"
                    type="number"
                    min={0.01}
                    step="0.01"
                    inputMode="decimal"
                    value={values.actualPrice}
                    onChange={(e) => setField("actualPrice", e.target.value)}
                    aria-invalid={errors.actualPrice ? true : undefined}
                    aria-describedby={errors.actualPrice ? "actual-error" : undefined}
                    className="w-full rounded border border-paper-line bg-paper-raised px-3 py-2 font-mono text-paper-ink outline-none focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                    placeholder="Not bought yet"
                  />
                </div>
                {errors.actualPrice && (
                  <p id="actual-error" role="alert" className="mt-1 text-sm font-medium text-must-ink">
                    {errors.actualPrice}
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="link" className="block font-mono text-xs uppercase tracking-wider text-paper-ink-muted">
              Link
            </label>
            <input
              id="link"
              type="text"
              inputMode="url"
              value={values.link}
              onChange={(e) => setField("link", e.target.value)}
              aria-invalid={errors.link ? true : undefined}
              aria-describedby={errors.link ? "link-error" : undefined}
              className="mt-1.5 w-full rounded border border-paper-line bg-paper-raised px-3 py-2 text-paper-ink outline-none focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              placeholder="https://…"
            />
            {errors.link && (
              <p id="link-error" role="alert" className="mt-1 text-sm font-medium text-must-ink">
                {errors.link}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="notes" className="block font-mono text-xs uppercase tracking-wider text-paper-ink-muted">
              Notes
            </label>
            <textarea
              id="notes"
              rows={3}
              value={values.notes}
              onChange={(e) => setField("notes", e.target.value)}
              maxLength={2000}
              className="mt-1.5 w-full resize-none rounded border border-paper-line bg-paper-raised px-3 py-2 text-paper-ink outline-none focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              placeholder="Model numbers, colours, who to ask, etc."
            />
          </div>

          <div>
            <label htmlFor="addedBy" className="block font-mono text-xs uppercase tracking-wider text-paper-ink-muted">
              Added by <span className="text-must-ink">*</span>
            </label>
            <input
              id="addedBy"
              value={values.addedBy}
              onChange={(e) => setField("addedBy", e.target.value)}
              aria-invalid={errors.addedBy ? true : undefined}
              aria-describedby={errors.addedBy ? "addedBy-error" : undefined}
              maxLength={80}
              className="mt-1.5 w-full rounded border border-paper-line bg-paper-raised px-3 py-2 text-paper-ink outline-none focus-visible:ring-2 focus-visible:ring-someday focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            />
            {errors.addedBy && (
              <p id="addedBy-error" role="alert" className="mt-1 text-sm font-medium text-must-ink">
                {errors.addedBy}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-paper-line px-5 py-4">
          {submitError && (
            <p role="alert" className="mb-3 text-sm font-medium text-must-ink">
              {submitError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-paper-line px-4 py-2 text-sm font-medium text-paper-ink-muted transition-colors hover:bg-paper-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-blueprint-bg px-4 py-2 text-sm font-medium text-blueprint-ink transition-colors hover:bg-blueprint-bg-raised disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
            >
              {submitting ? "Saving…" : mode === "add" ? "Add item" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
