"use client";

import { useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, GripVertical, Link2, Plus, Trash2 } from "lucide-react";
import { formatGBP, linkLabel, normaliseLink } from "@/lib/format";
import { pastedLines } from "@/lib/parse";
import { readableLink, titleFromUrl } from "@/lib/unfurl";
import { useUnfurl } from "@/lib/useUnfurl";
import { prefersReducedMotion, spring, type Spring } from "@/lib/motion";
import { Button, Field, MoneyInput, Suggestion, inputClass } from "@/components/ui";

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

  // A step with a shop link (supplies for a job) can take its price, and its
  // name if it's still named after the link, from the page. Only one is read
  // at a time: the open step, or else the latest one added.
  const wantsPage = (s: DraftStep) => {
    const url = readableLink(s.link);
    return !!url && (!s.cost.trim() || s.text.trim() === titleFromUrl(url));
  };
  const probe =
    steps.find((s) => s.key === open && wantsPage(s)) ??
    [...steps].reverse().find((s) => s.key.startsWith("new-") && wantsPage(s));
  const page = useUnfurl(probe ? readableLink(probe.link) : null);

  const update = (key: string, patch: Partial<DraftStep>) =>
    onChange(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const remove = (key: string) => onChange(steps.filter((s) => s.key !== key));

  // The step being dragged: where the finger is, and where on the row it took hold.
  const held = useRef<{ key: string; grab: number; y: number } | null>(null);
  // Where each row was on screen just before a move, so the others can glide.
  const before = useRef<Map<string, number> | null>(null);
  const landing = useRef<{ anim: Spring; row: HTMLElement } | null>(null);

  const rows = () =>
    new Map(([...(listRef.current?.children ?? [])] as HTMLElement[]).map((el) => [el.dataset.step ?? "", el]));
  // Where a row sits in the layout, leaving out any shift it's animating by.
  const layoutTop = (el: HTMLElement) => el.getBoundingClientRect().top - new DOMMatrix(getComputedStyle(el).transform).m42;

  function move(key: string, to: number) {
    const list = stepsRef.current;
    const from = list.findIndex((s) => s.key === key);
    if (from < 0 || to < 0 || to >= list.length || to === from) return;
    const next = [...list];
    const [step] = next.splice(from, 1);
    next.splice(to, 0, step);
    before.current = new Map([...rows()].map(([k, el]) => [k, el.getBoundingClientRect().top]));
    onChangeRef.current(next);
  }

  /** Keep the held row under the finger, inside the list. */
  function follow() {
    const h = held.current;
    const row = h && rows().get(h.key);
    const list = listRef.current;
    if (!h || !row || !list) return;
    const box = list.getBoundingClientRect();
    const top = Math.min(Math.max(h.y - h.grab, box.top), box.bottom - row.offsetHeight);
    row.style.transform = `translateY(${top - layoutTop(row)}px)`;
  }

  useLayoutEffect(() => {
    // Moving a row re-inserts it in the DOM, which drops focus; put it back.
    if (refocus.current) {
      listRef.current?.querySelector<HTMLElement>(`[data-grip="${refocus.current}"]`)?.focus();
      refocus.current = null;
    }
    // Rows that changed places slide from where they were, rather than jumping.
    const was = before.current;
    if (!was) return;
    before.current = null;
    for (const [key, row] of rows()) {
      if (key === held.current?.key) continue;
      const from = was.get(key);
      if (from == null) continue;
      row.getAnimations().forEach((a) => a.cancel());
      const shift = from - layoutTop(row);
      if (!shift || prefersReducedMotion()) continue;
      row.animate([{ transform: `translateY(${shift}px)` }, { transform: "none" }], {
        duration: 200,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      });
    }
    follow();
  });

  function startDrag(e: React.PointerEvent, key: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    const row = (e.currentTarget as HTMLElement).closest("li");
    if (!row) return;
    // Caught while settling: carry on from where it is. Another row still
    // settling just lands.
    if (landing.current) {
      landing.current.anim.stop();
      if (landing.current.row !== row) landing.current.row.style.transform = "";
      landing.current = null;
    }
    held.current = { key, grab: e.clientY - row.getBoundingClientRect().top, y: e.clientY };
    setDragging(key);
    // The row follows the finger, and swaps places as the finger passes
    // each other row's middle.
    const onMove = (ev: PointerEvent) => {
      if (!held.current) return;
      held.current.y = ev.clientY;
      const all = [...rows().values()];
      const from = stepsRef.current.findIndex((s) => s.key === key);
      let to = from;
      all.forEach((other, i) => {
        const middle = layoutTop(other) + other.offsetHeight / 2;
        if (i < from && ev.clientY < middle) to = Math.min(to, i);
        if (i > from && ev.clientY > middle) to = Math.max(to, i);
      });
      move(key, to);
      follow();
    };
    const onUp = () => {
      held.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      // Let go: it settles into its slot.
      const el = rows().get(key);
      if (!el) return setDragging(null);
      const anim = spring(
        new DOMMatrix(getComputedStyle(el).transform).m42,
        0,
        (y) => (el.style.transform = y ? `translateY(${y}px)` : ""),
        {
          response: 0.3,
          onDone: () => {
            landing.current = null;
            setDragging((d) => (d === key ? null : d));
          },
        },
      );
      landing.current = { anim, row: el };
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
            const found = probe?.key === step.key ? page.data : null;
            const offerCost = found?.price != null && !step.cost.trim() ? found.price : null;
            const offerName =
              found?.title && step.text.trim() === titleFromUrl(readableLink(step.link) ?? "") ? found.title : null;
            return (
              <li
                key={step.key}
                data-step={step.key}
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
                      "hit grid h-10 w-7 shrink-0 touch-none place-items-center rounded-md text-ink-3 hover:text-ink",
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
                      "min-w-0 flex-1 bg-transparent py-2.5 pl-1 text-body outline-none",
                      step.done && "text-ink-3 line-through",
                    )}
                  />
                  {cost != null && !Number.isNaN(cost) && (
                    <span className="shrink-0 text-supporting text-ink-2 tabular">{formatGBP(cost)}</span>
                  )}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={`Cost, link and details for “${step.text}”`}
                    onClick={() => setOpen(isOpen ? null : step.key)}
                    className="hit grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-ink"
                  >
                    <ChevronDown size={16} className={clsx("transition-transform", isOpen && "rotate-180")} />
                  </button>
                </div>

                {!isOpen && (link || step.notes.trim()) && (
                  <div className="-mt-1 flex min-w-0 items-center gap-3 pr-3 pb-2 pl-[58px] text-meta text-ink-3">
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

                {(offerCost != null || offerName) && (
                  <div className="flex min-w-0 flex-wrap gap-1.5 pr-3 pb-2.5 pl-[58px]" aria-live="polite">
                    {offerCost != null && (
                      <Suggestion onClick={() => update(step.key, { cost: String(offerCost) })}>
                        Use {formatGBP(offerCost)} from {found!.siteName ?? linkLabel(found!.url)}
                      </Suggestion>
                    )}
                    {offerName && (
                      <Suggestion onClick={() => update(step.key, { text: offerName.slice(0, 200) })}>
                        Call it “{offerName}”
                      </Suggestion>
                    )}
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
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-control border border-line text-ink-2 hover:bg-sunken"
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
          // Long enough for a pasted product link, which becomes the step's link.
          maxLength={2000}
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
  children,
}: {
  links: { key: string; url: string }[];
  onChange: (links: { key: string; url: string }[]) => void;
  newLink: string;
  onNewLink: (url: string) => void;
  onAdd: () => void;
  /** Shown under the box: what was found on a linked page. */
  children?: React.ReactNode;
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
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-control border border-line text-ink-2 hover:bg-sunken"
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
      {children}
    </Field>
  );
}
