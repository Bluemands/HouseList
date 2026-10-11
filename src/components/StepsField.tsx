"use client";

import { useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, GripVertical, Link2, Plus, Trash2 } from "lucide-react";
import { formatGBP, linkLabel, normaliseLink } from "@/lib/format";
import { pastedLines } from "@/lib/parse";
import { Button, Field, MoneyInput, inputClass } from "@/components/ui";

export type DraftStep = {
  id?: string;
  key: string;
  text: string;
  done: boolean;
  cost: string;
  link: string;
  notes: string;
};

/** A step's cost as typed: null if blank, NaN if it isn't a number. */
export function parseMoney(s: string): number | null {
  const t = s.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/**
 * An item's steps: tick them off, give each its own cost, link and details,
 * and put them in order — drag the grip, or focus it and use the arrow keys.
 */
export function StepsField({
  steps,
  onChange,
  newStep,
  onNewStep,
  onAdd,
}: {
  steps: DraftStep[];
  onChange: (steps: DraftStep[]) => void;
  newStep: string;
  onNewStep: (text: string) => void;
  /** Adds what's in the box, or each of several pasted lines. */
  onAdd: (lines?: string[]) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const refocus = useRef<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Window listeners outlive a render, so they read the latest steps from here.
  const stepsRef = useRef(steps);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    stepsRef.current = steps;
    onChangeRef.current = onChange;
  });

  const update = (key: string, patch: Partial<DraftStep>) =>
    onChange(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const remove = (key: string) => onChange(steps.filter((s) => s.key !== key));

  function move(key: string, to: number) {
    const list = stepsRef.current;
    const from = list.findIndex((s) => s.key === key);
    if (from < 0 || to < 0 || to >= list.length || to === from) return;
    const next = [...list];
    const [step] = next.splice(from, 1);
    next.splice(to, 0, step);
    onChangeRef.current(next);
  }

  // Moving a row re-inserts it in the DOM, which drops focus; put it back.
  useLayoutEffect(() => {
    if (!refocus.current) return;
    listRef.current?.querySelector<HTMLElement>(`[data-grip="${refocus.current}"]`)?.focus();
    refocus.current = null;
  });

  function startDrag(e: React.PointerEvent, key: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging(key);
    // The row under the pointer swaps places as it passes each row's middle.
    const onMove = (ev: PointerEvent) => {
      const rows = listRef.current ? ([...listRef.current.children] as HTMLElement[]) : [];
      const from = stepsRef.current.findIndex((s) => s.key === key);
      let to = from;
      rows.forEach((row, i) => {
        const r = row.getBoundingClientRect();
        const middle = r.top + r.height / 2;
        if (i < from && ev.clientY < middle) to = Math.min(to, i);
        if (i > from && ev.clientY > middle) to = Math.max(to, i);
      });
      move(key, to);
    };
    const onUp = () => {
      setDragging(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return (
    <Field label="Steps">
      {steps.length > 0 && (
        <ul ref={listRef} className="overflow-hidden rounded-xl border border-line">
          {steps.map((step, index) => {
            const isOpen = open === step.key;
            const link = normaliseLink(step.link);
            const cost = parseMoney(step.cost);
            return (
              <li
                key={step.key}
                className={clsx(
                  "border-b border-line bg-surface last:border-b-0",
                  dragging === step.key && "relative z-10 bg-sunken shadow-pop",
                )}
              >
                <div className="flex items-center gap-1.5 pr-1.5 pl-0.5">
                  <button
                    type="button"
                    data-grip={step.key}
                    aria-label={`Reorder “${step.text}”, step ${index + 1} of ${steps.length}. Use the up and down arrow keys.`}
                    onPointerDown={(e) => startDrag(e, step.key)}
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                      e.preventDefault();
                      refocus.current = step.key;
                      move(step.key, index + (e.key === "ArrowUp" ? -1 : 1));
                    }}
                    className={clsx(
                      "grid h-10 w-7 shrink-0 touch-none place-items-center rounded-md text-ink-3 hover:text-ink",
                      dragging === step.key ? "cursor-grabbing" : "cursor-grab",
                    )}
                  >
                    <GripVertical size={16} />
                  </button>
                  <input
                    type="checkbox"
                    checked={step.done}
                    aria-label={`Step done: ${step.text}`}
                    onChange={(e) => update(step.key, { done: e.target.checked })}
                    className="h-[18px] w-[18px] shrink-0 accent-[var(--accent)]"
                  />
                  <input
                    value={step.text}
                    aria-label={`Step ${index + 1}`}
                    maxLength={200}
                    onChange={(e) => update(step.key, { text: e.target.value })}
                    onBlur={() => !step.text.trim() && remove(step.key)}
                    className={clsx(
                      "min-w-0 flex-1 bg-transparent py-2.5 pl-1 text-[15px] outline-none",
                      step.done && "text-ink-3 line-through",
                    )}
                  />
                  {cost != null && !Number.isNaN(cost) && (
                    <span className="shrink-0 text-[13.5px] text-ink-2 tabular">{formatGBP(cost)}</span>
                  )}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={`Cost, link and details for “${step.text}”`}
                    onClick={() => setOpen(isOpen ? null : step.key)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink"
                  >
                    <ChevronDown size={16} className={clsx("transition-transform", isOpen && "rotate-180")} />
                  </button>
                </div>

                {!isOpen && (link || step.notes.trim()) && (
                  <div className="-mt-1 flex min-w-0 items-center gap-3 pr-3 pb-2 pl-[58px] text-[12.5px] text-ink-3">
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 font-medium text-accent-text hover:underline"
                      >
                        <Link2 size={13} /> {linkLabel(link)}
                      </a>
                    )}
                    {step.notes.trim() && <span className="min-w-0 truncate">{step.notes}</span>}
                  </div>
                )}

                {isOpen && (
                  <div className="grid gap-2 pr-3 pb-3 pl-[58px]">
                    <MoneyInput
                      label={`Cost of “${step.text}”`}
                      placeholder="Cost of this step"
                      value={step.cost}
                      onChange={(v) => update(step.key, { cost: v })}
                    />
                    <div className="flex items-center gap-2">
                      <input
                        value={step.link}
                        onChange={(e) => update(step.key, { link: e.target.value })}
                        placeholder="Link — product, supplier, how-to…"
                        inputMode="url"
                        aria-label={`Link for “${step.text}”`}
                        className={inputClass}
                      />
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open link"
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-line text-ink-2 hover:bg-sunken"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                    <textarea
                      value={step.notes}
                      onChange={(e) => update(step.key, { notes: e.target.value })}
                      rows={2}
                      placeholder="Details — sizes, colours, who's doing it…"
                      aria-label={`Details for “${step.text}”`}
                      maxLength={1000}
                      className={clsx(inputClass, "resize-y")}
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => move(step.key, index - 1)}
                        className="px-2.5 py-2"
                      >
                        <ArrowUp size={15} /> Up
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={index === steps.length - 1}
                        onClick={() => move(step.key, index + 1)}
                        className="px-2.5 py-2"
                      >
                        <ArrowDown size={15} /> Down
                      </Button>
                      <Button variant="danger" onClick={() => remove(step.key)} className="ml-auto px-2.5 py-2">
                        <Trash2 size={15} /> Remove
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={newStep}
          onChange={(e) => onNewStep(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          onPaste={(e) => {
            // A pasted list becomes one step per line.
            const lines = pastedLines(e.clipboardData.getData("text"));
            if (lines.length < 2) return;
            e.preventDefault();
            onAdd(lines);
          }}
          placeholder={steps.length ? "Add another step" : "Break it down — e.g. Deposit £200, Fit tiles…"}
          aria-label="New step"
          maxLength={200}
          className={inputClass}
        />
        <Button variant="secondary" onClick={() => onAdd()} aria-label="Add step" className="shrink-0 px-3">
          <Plus size={17} />
        </Button>
      </div>
    </Field>
  );
}

/** Several links for one item, each openable; a blank one waits at the end. */
export function LinksField({
  links,
  onChange,
  newLink,
  onNewLink,
  onAdd,
}: {
  links: { key: string; url: string }[];
  onChange: (links: { key: string; url: string }[]) => void;
  newLink: string;
  onNewLink: (url: string) => void;
  onAdd: () => void;
}) {
  return (
    <Field label="Links">
      {links.length > 0 && (
        <ul className="grid gap-1.5">
          {links.map((l, index) => {
            const href = normaliseLink(l.url);
            return (
              <li key={l.key} className="flex items-center gap-2">
                <input
                  value={l.url}
                  onChange={(e) => onChange(links.map((x) => (x.key === l.key ? { ...x, url: e.target.value } : x)))}
                  onBlur={() => !l.url.trim() && onChange(links.filter((x) => x.key !== l.key))}
                  inputMode="url"
                  aria-label={`Link ${index + 1}`}
                  className={inputClass}
                />
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${linkLabel(href)}`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-line text-ink-2 hover:bg-sunken"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
                <button
                  type="button"
                  aria-label={`Remove link ${index + 1}`}
                  onClick={() => onChange(links.filter((x) => x.key !== l.key))}
                  className="grid h-11 w-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={newLink}
          onChange={(e) => onNewLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={links.length ? "Add another link" : "Product page, quote, video…"}
          inputMode="url"
          aria-label="New link"
          className={inputClass}
        />
        <Button variant="secondary" onClick={onAdd} aria-label="Add link" className="shrink-0 px-3">
          <Plus size={17} />
        </Button>
      </div>
    </Field>
  );
}
