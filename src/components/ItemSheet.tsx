"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Copy, Hammer, Pin, ShoppingBag, Trash2, X } from "lucide-react";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  REPEATS,
  REPEAT_SHORT,
  ROOMS,
  STATUSES,
  STATUS_LABELS,
  TITLE_MAX,
  rebaseSteps,
  stepCostsKey,
  stepsTotal,
  type ItemDTO,
  type Kind,
  type Priority,
  type Repeat,
  type Room,
  type Status,
} from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";
import { addDays, addYears, formatDay, formatGBP, isWebLink, normaliseLink, timeAgo, today, toDayString } from "@/lib/format";
import { useStore, type SheetRestore } from "@/lib/store";
import { parseStep } from "@/lib/parse";
import { readableLink, siteOf, splitLink, titleFromUrl } from "@/lib/unfurl";
import { useUnfurl } from "@/lib/useUnfurl";
import { useSheetDrag } from "@/lib/useSheetDrag";
import type { ItemUpdateInput } from "@/lib/validation";
import { Button, Chip, Field, GrowingTextarea, MoneyInput, PaintChip, Segmented, Suggestion, inputClass } from "@/components/ui";
import { QuotesField, UpdatesField } from "@/components/ItemExtras";
import { AskClaude } from "@/components/AskClaude";
import { LinksField, StepsField, parseMoney, type DraftStep } from "@/components/StepsField";

type Draft = {
  title: string;
  kind: Kind;
  status: Status;
  priority: Priority;
  room: Room;
  assignee: string;
  dueDate: string;
  warrantyUntil: string;
  estimatedPrice: string;
  estimateMax: string;
  isQuote: boolean;
  actualPrice: string;
  project: string;
  repeat: Repeat | null;
  links: { key: string; url: string }[];
  notes: string;
  steps: DraftStep[];
};

const num = (n: number | null | undefined) => (n == null ? "" : String(n));

function toDraft(item: Partial<ItemDTO>): Draft {
  return {
    title: item.title ?? "",
    kind: item.kind ?? "TASK",
    status: item.status ?? "TODO",
    priority: item.priority ?? "WOULD_LIKE",
    room: item.room ?? "WHOLE_HOUSE",
    assignee: item.assignee ?? "",
    dueDate: item.dueDate ?? "",
    warrantyUntil: item.warrantyUntil ?? "",
    estimatedPrice: num(item.estimatedPrice),
    estimateMax: num(item.estimateMax),
    isQuote: item.isQuote ?? false,
    actualPrice: num(item.actualPrice),
    project: item.project ?? "",
    repeat: item.repeat ?? null,
    links: (item.links ?? []).map((url, i) => ({ key: `link-${i}`, url })),
    notes: item.notes ?? "",
    steps: (item.steps ?? []).map((s, i) => ({
      // Duplicated steps have no id yet; they still need a key of their own.
      id: s.id || undefined,
      key: s.id || `copy-${i}`,
      text: s.text,
      done: s.done,
      cost: num(s.cost),
      link: s.link ?? "",
      notes: s.notes ?? "",
    })),
  };
}

const stepPayload = (s: DraftStep) => ({
  id: s.id,
  text: s.text.trim(),
  done: s.done,
  cost: parseMoney(s.cost),
  link: normaliseLink(s.link),
  notes: s.notes.trim() || null,
});

const linksPayload = (urls: string[]) => [...new Set(urls.map(normaliseLink).filter((u): u is string => !!u))];

export function ItemSheet() {
  const { editing, items, closeItem } = useStore();
  const item = editing && editing.id !== "new" ? items.find((i) => i.id === editing.id) : undefined;
  const gone = !!editing && editing.id !== "new" && !item;
  // Deleted by the other phone while open: let go, or the app stays "editing".
  useEffect(() => {
    if (gone) closeItem();
  }, [gone, closeItem]);
  if (!editing || gone) return null;
  return <SheetBody key={editing.id} item={item} defaults={editing.defaults} restore={editing.restore} />;
}

function SheetBody({
  item,
  defaults,
  restore,
}: {
  item?: ItemDTO;
  defaults?: Partial<ItemDTO>;
  restore?: SheetRestore;
}) {
  const { closeItem, openItem, addItem, patchItem, removeItem, settings, items, me } = useStore();
  const isNew = !item;
  // What the sheet opened with. Edits are diffed against this snapshot rather
  // than the live item, so a change the other person makes while this is
  // open is never overwritten by our stale copy of that field.
  const [initial, setInitial] = useState<Draft>(() => toDraft(item ?? defaults ?? {}));
  const [draft, setDraft] = useState<Draft>(() => (restore?.draft as Draft | undefined) ?? initial);
  const [error, setError] = useState<string | null>(restore?.error ?? null);
  const [newStep, setNewStep] = useState("");
  const [newLink, setNewLink] = useState("");
  // The link to read for a name and price: one added in this sheet, or the
  // link a new item arrived with from quick add.
  const [lookup, setLookup] = useState<string | null>(() => (isNew ? (defaults?.links?.[0] ?? null) : null));
  const page = useUnfurl(readableLink(newLink) ?? lookup);
  // Where focus was when the sheet opened, to hand it back on close.
  const [opener] = useState(() => (typeof document === "undefined" ? null : document.activeElement));
  const [customWho, setCustomWho] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const roomRailRef = useRef<HTMLDivElement>(null);
  const dismiss = () => (isNew && !draft.title.trim() ? closeItem() : save());
  const dragHandlers = useSheetDrag(dismiss);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    if (isNew) titleRef.current?.focus();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [isNew, opener]);

  // The room rail scrolls sideways; open it at this item's room, not the first one.
  useEffect(() => {
    const rail = roomRailRef.current;
    const chip = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!rail || !chip) return;
    const r = rail.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    rail.scrollLeft += c.left - r.left - (r.width - c.width) / 2;
  }, []);

  // Grow the title box to fit.
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [draft.title]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initial) || newStep.trim() !== "" || newLink.trim() !== "";
  // When steps carry costs, the estimate is their total rather than typed in —
  // unless a quote set it since, and the step costs haven't changed after.
  const stepCosts = draft.steps.map((s) => parseMoney(s.cost));
  const fromSteps = stepsTotal(stepCosts.map((cost) => ({ cost: Number.isNaN(cost) ? null : cost })));
  const costsKey = (d: Draft) => stepCostsKey(d.steps.map((s) => ({ cost: parseMoney(s.cost) })));
  const initialTotal = stepsTotal(initial.steps.map((s) => ({ cost: parseMoney(s.cost) })));
  const followsSteps =
    fromSteps != null &&
    (costsKey(draft) !== costsKey(initial) || parseMoney(initial.estimatedPrice) === initialTotal);
  const paidSoFar = draft.steps.reduce((sum, st, i) => sum + (st.done && stepCosts[i] ? stepCosts[i]! : 0), 0);

  const people = useMemo(() => {
    const names = new Set([...settings.members, me]);
    return [...names, "Both"];
  }, [settings.members, me]);
  const projects = useMemo(
    () => [...new Set(items.map((i) => i.project).filter((p): p is string => !!p))].sort(),
    [items],
  );

  function buildPayload(): ItemUpdateInput | string {
    const title = draft.title.trim();
    if (!title) return "Give it a name first";
    const estimatedPrice = parseMoney(draft.estimatedPrice);
    const estimateMax = parseMoney(draft.estimateMax);
    const actualPrice = parseMoney(draft.actualPrice);
    if ([estimatedPrice, estimateMax, actualPrice, ...stepCosts].some((n) => Number.isNaN(n))) {
      return "Prices need to be numbers";
    }
    // Caught here, not by the server, so a typo never costs the whole edit.
    const badLink = [...draft.links.map((l) => l.url), newLink, ...draft.steps.map((st) => st.link)]
      .map(normaliseLink)
      .find((u) => u && !isWebLink(u));
    if (badLink) return `“${badLink.replace(/^https:\/\//, "")}” isn't a web address. Use the full link, e.g. screwfix.com/…`;
    const steps = [...draft.steps];
    if (newStep.trim()) steps.push({ key: "pending", text: newStep.trim(), done: false, cost: "", link: "", notes: "" });
    return {
      title,
      kind: draft.kind,
      status: draft.status,
      priority: draft.priority,
      room: draft.room,
      assignee: draft.assignee.trim() || null,
      dueDate: draft.dueDate || null,
      warrantyUntil: draft.warrantyUntil || null,
      ...(followsSteps
        ? { estimatedPrice: fromSteps, estimateMax: null }
        : {
            estimatedPrice,
            estimateMax:
              estimateMax != null && estimatedPrice != null && estimateMax <= estimatedPrice ? null : estimateMax,
          }),
      isQuote: draft.isQuote,
      actualPrice,
      project: draft.project.trim() || null,
      repeat: draft.repeat,
      links: linksPayload([...draft.links.map((l) => l.url), newLink]),
      notes: draft.notes.trim() || null,
      steps: steps.map(stepPayload),
    };
  }

  async function save() {
    if (!dirty && !isNew) return closeItem();
    const payload = buildPayload();
    if (typeof payload === "string") {
      setError(payload);
      return;
    }
    // Saving closes at once; if it then fails (offline, say), the sheet comes
    // back with everything as typed rather than losing it.
    const typed: Draft = {
      ...draft,
      steps: newStep.trim()
        ? [...draft.steps, { key: `new-${Date.now()}`, text: newStep.trim(), done: false, cost: "", link: "", notes: "" }]
        : draft.steps,
      links: newLink.trim() ? [...draft.links, { key: `new-${Date.now()}`, url: newLink.trim() }] : draft.links,
    };
    const reopen = () =>
      openItem(isNew ? "new" : item!.id, defaults, {
        draft: typed,
        error: "That didn't save, so your changes are still here. Try again.",
      });
    closeItem();
    if (isNew) {
      if (!(await addItem({ ...payload, title: payload.title! }))) reopen();
    } else {
      // Only send what changed, so two people editing different fields of the
      // same item don't overwrite each other.
      const before = buildFrom(initial);
      const changes = Object.fromEntries(
        Object.entries(payload).filter(
          ([k, v]) => JSON.stringify(v) !== JSON.stringify((before as Record<string, unknown>)[k]),
        ),
      ) as ItemUpdateInput;
      // Steps go as one whole list: keep what happened to them elsewhere
      // while this was open (a tick on the other phone, Claude's additions).
      if (changes.steps) {
        changes.steps = rebaseSteps(
          changes.steps,
          initial.steps.flatMap((s) => (s.id ? [{ id: s.id, done: s.done }] : [])),
          item!.steps.map(({ id, text, done, cost, link, notes }) => ({ id, text, done, cost, link, notes })),
        );
      }
      if (Object.keys(changes).length && !(await patchItem(item!.id, changes))) reopen();
    }
  }

  function buildFrom(d: Draft): ItemUpdateInput {
    return {
      title: d.title.trim(),
      kind: d.kind,
      status: d.status,
      priority: d.priority,
      room: d.room,
      assignee: d.assignee.trim() || null,
      dueDate: d.dueDate || null,
      warrantyUntil: d.warrantyUntil || null,
      estimatedPrice: parseMoney(d.estimatedPrice),
      estimateMax: parseMoney(d.estimateMax),
      isQuote: d.isQuote,
      actualPrice: parseMoney(d.actualPrice),
      project: d.project.trim() || null,
      repeat: d.repeat,
      links: linksPayload(d.links.map((l) => l.url)),
      notes: d.notes.trim() || null,
      steps: d.steps.map(stepPayload),
    };
  }

  function addStep(lines = [newStep]) {
    const added: DraftStep[] = lines
      .filter((l) => l.trim())
      .map((line, i) => {
        // A pasted product link becomes the step's link, named from the link
        // until the page is read.
        const { url, rest } = splitLink(line);
        const { text, cost } = rest ? parseStep(rest) : { text: titleFromUrl(url!), cost: null };
        return {
          key: `new-${Date.now()}-${i}`,
          text: text.slice(0, 200),
          done: false,
          cost: num(cost),
          link: url ?? "",
          notes: "",
        };
      });
    if (!added.length) return;
    setDraft((d) => ({ ...d, steps: [...d.steps, ...added] }));
    setNewStep("");
  }

  // The same thing again — for another room, or next time — as a new item.
  function duplicate() {
    const payload = buildPayload();
    if (typeof payload === "string") return setError(payload);
    save();
    openItem("new", {
      ...payload,
      title: payload.title,
      status: "TODO",
      actualPrice: null,
      pinned: false,
      warrantyUntil: null,
      links: payload.links ?? [],
      steps: (payload.steps ?? []).map((st) => ({
        id: "",
        text: st.text,
        done: false,
        cost: st.cost ?? null,
        link: (st.link as string | null) ?? null,
        notes: (st.notes as string | null) ?? null,
        potCharge: null,
        doneAt: null,
      })),
    } as Partial<ItemDTO>);
  }

  // Parts of Claude's suggestion go into the draft as if typed, so they save
  // with everything else through the usual item update (and its pot and
  // estimate rules). Each hands back how to take itself out again.
  function applyEstimate(min: number, max: number) {
    const before = { estimatedPrice: draft.estimatedPrice, estimateMax: draft.estimateMax };
    const low = Math.round(min);
    const high = Math.round(max);
    setDraft((d) => ({ ...d, estimatedPrice: num(low), estimateMax: high > low ? num(high) : "" }));
    return () => setDraft((d) => ({ ...d, ...before }));
  }

  function addSuggestedSteps(steps: { text: string; cost?: number; link?: string; notes?: string }[]) {
    const stamp = Date.now();
    const added: DraftStep[] = steps.map((s, i) => ({
      key: `claude-${stamp}-${i}`,
      text: s.text.slice(0, 200),
      done: false,
      cost: s.cost ? num(Math.round(s.cost * 100) / 100) : "",
      link: s.link ?? "",
      notes: s.notes ?? "",
    }));
    const keys = new Set(added.map((s) => s.key));
    setDraft((d) => ({ ...d, steps: [...d.steps, ...added].slice(0, 50) }));
    return () => setDraft((d) => ({ ...d, steps: d.steps.filter((s) => !keys.has(s.key)) }));
  }

  function addSuggestedLink(url: string) {
    const key = `claude-${Date.now()}`;
    setDraft((d) =>
      d.links.some((l) => l.url === url) || d.links.length >= 20 ? d : { ...d, links: [...d.links, { key, url }] },
    );
    return () => setDraft((d) => ({ ...d, links: d.links.filter((l) => l.key !== key) }));
  }

  function addLink() {
    if (!newLink.trim()) return;
    const url = normaliseLink(newLink);
    if (url && isWebLink(url)) setLookup(url);
    setDraft((d) => ({ ...d, links: [...d.links, { key: `new-${Date.now()}`, url: newLink.trim() }] }));
    setNewLink("");
  }

  // A shop link added here (or pasted, before it's even added) is read for
  // its name and price, offered with a tap — never filled in unasked.
  const found = page.data;
  const placeholderTitle =
    !draft.title.trim() ||
    [lookup, readableLink(newLink), found?.url].some((u) => u && titleFromUrl(u) === draft.title.trim());
  const offerTitle = found?.title && placeholderTitle && found.title !== draft.title.trim() ? found.title : null;
  const offerPrice =
    found?.price != null && !followsSteps && !draft.estimatedPrice.trim() && !draft.estimateMax.trim() ? found.price : null;
  const shop = found ? (found.siteName ?? siteOf(found.url)) : null;

  const isPerson = !draft.assignee || people.includes(draft.assignee);
  const t = today();
  const dueChips = [
    { label: "Today", day: t },
    { label: "Tomorrow", day: addDays(t, 1) },
    { label: "This weekend", day: nextSaturday() },
    { label: "Next week", day: nextMonday() },
  ];
  const statusLabels = STATUS_LABELS[draft.kind];

  return (
    <dialog
      ref={dialogRef}
      aria-label={isNew ? "New item" : `Edit ${item!.title}`}
      onCancel={(e) => {
        e.preventDefault();
        if (isNew && !draft.title.trim()) closeItem();
        else save();
      }}
      onClick={(e) => {
        // Tapping the dimmed backdrop saves and closes.
        if (e.target === e.currentTarget) save();
      }}
      className={clsx(
        "sheet m-0 flex max-h-none max-w-none flex-col overflow-hidden bg-surface p-0 text-ink shadow-sheet backdrop:bg-transparent",
        "inset-x-0 top-auto bottom-0 h-[min(92dvh,860px)] w-full rounded-t-[22px]",
        "lg:inset-y-0 lg:right-0 lg:left-auto lg:h-dvh lg:w-[460px] lg:rounded-none lg:rounded-l-[22px]",
      )}
    >
      <div {...dragHandlers} className="flex touch-none items-center justify-between gap-2 px-4 pt-3 pb-1">
        <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-line-strong lg:hidden" />
        {item ? (
          <button
            type="button"
            aria-pressed={item.pinned}
            onClick={() => patchItem(item.id, { pinned: !item.pinned })}
            className={clsx(
              "mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
              item.pinned ? "bg-accent-soft text-accent-text" : "text-ink-2 hover:bg-sunken hover:text-ink",
            )}
          >
            <Pin size={14} strokeWidth={2.3} className={item.pinned ? "fill-current" : undefined} />
            {item.pinned ? "Pinned to the top" : "Pin to the top"}
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="mt-1 grid h-9 w-9 place-items-center rounded-full text-ink-2 hover:bg-sunken"
        >
          <X size={19} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        <textarea
          ref={titleRef}
          rows={1}
          value={draft.title}
          onChange={(e) => {
            set("title", e.target.value.replace(/\n/g, ""));
            setError(null);
          }}
          placeholder={draft.kind === "BUY" ? "What do you need to buy?" : "What needs doing?"}
          aria-label="Title"
          maxLength={TITLE_MAX}
          className="w-full resize-none overflow-hidden bg-transparent py-2 text-[22px] leading-tight font-bold tracking-[-0.015em] text-ink outline-none placeholder:text-ink-3"
        />
        {error && (
          <p role="alert" className="mb-2 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <div className="mt-3 grid gap-5">
          {/* Side by side only when "To buy · Ordered · Bought" has room to fit. */}
          <div className="grid gap-2 sm:grid-cols-2">
            <Segmented
              label="Type"
              value={draft.kind}
              onChange={(v) => set("kind", v)}
              options={[
                { value: "TASK", label: <><Hammer size={14} strokeWidth={2.2} aria-hidden="true" /> Job</> },
                { value: "BUY", label: <><ShoppingBag size={14} strokeWidth={2.2} aria-hidden="true" /> To buy</> },
              ]}
            />
            <Segmented
              label="Status"
              value={draft.status}
              onChange={(v) => set("status", v)}
              size="sm"
              options={STATUSES.map((s) => ({ value: s, label: statusLabels[s] }))}
            />
          </div>

          <Field label="Priority">
            <Segmented
              label="Priority"
              value={draft.priority}
              onChange={(v) => set("priority", v)}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
            />
          </Field>

          <Field label="Room">
            <div ref={roomRailRef} className="rail -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
              {ROOMS.map((room) => (
                <Chip key={room} selected={draft.room === room} onClick={() => set("room", room)}>
                  <PaintChip room={room} />
                  {ROOM_PAINT[room].label}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Who's on it">
            <div className="flex flex-wrap gap-1.5">
              {people.map((p) => (
                <Chip
                  key={p}
                  selected={draft.assignee === p}
                  onClick={() => {
                    setCustomWho(false);
                    set("assignee", draft.assignee === p ? "" : p);
                  }}
                >
                  {p === me ? `${p} (you)` : p}
                </Chip>
              ))}
              <Chip
                selected={customWho || !isPerson}
                onClick={() => {
                  setCustomWho(true);
                  if (isPerson) set("assignee", "");
                }}
              >
                Someone else
              </Chip>
            </div>
            {(customWho || !isPerson) && (
              <input
                autoFocus={customWho}
                value={draft.assignee}
                onChange={(e) => set("assignee", e.target.value)}
                placeholder="e.g. Electrician, Dad, Gary the plasterer"
                aria-label="Who's doing it"
                maxLength={60}
                className={inputClass}
              />
            )}
          </Field>

          <Field label="When">
            <div className="flex flex-wrap gap-1.5">
              {dueChips.map((c) => (
                <Chip key={c.label} selected={draft.dueDate === c.day} onClick={() => set("dueDate", draft.dueDate === c.day ? "" : c.day)}>
                  {c.label}
                </Chip>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
                aria-label="Due date"
                className={clsx(inputClass, "tabular")}
              />
              {draft.dueDate && (
                <Button variant="ghost" onClick={() => set("dueDate", "")} className="shrink-0">
                  Clear
                </Button>
              )}
            </div>
          </Field>

          <Field
            label="Repeats"
            hint={draft.repeat ? "Ticking it off schedules the next one, counted from the day it's done." : undefined}
          >
            <div className="flex flex-wrap gap-1.5">
              <Chip selected={!draft.repeat} onClick={() => set("repeat", null)}>
                Never
              </Chip>
              {REPEATS.map((r) => (
                <Chip key={r} selected={draft.repeat === r} onClick={() => set("repeat", r)}>
                  {REPEAT_SHORT[r]}
                </Chip>
              ))}
            </div>
          </Field>

          <Field
            label="Cost"
            hint={
              draft.status === "DONE"
                ? "What you actually paid comes out of the pot."
                : followsSteps
                  ? "Set by the steps’ costs below. Clear those to enter one figure here."
                  : fromSteps != null
                    ? `The steps add up to ${formatGBP(fromSteps)}. Change a step's cost to use that instead.`
                  : "Leave blank if it's free. Add an upper figure for a range, or cost each step below."
            }
          >
            {followsSteps ? (
              <div className="flex items-baseline justify-between gap-3 rounded-[10px] border border-line bg-sunken px-3 py-2.5">
                <span className="text-[15px] font-semibold text-ink tabular">{formatGBP(fromSteps)}</span>
                <span className="text-[13px] text-ink-3 tabular">
                  {paidSoFar > 0 && draft.status !== "DONE"
                    ? `${formatGBP(paidSoFar)} paid · ${formatGBP(Math.max(0, fromSteps - paidSoFar))} to go`
                    : "Total of the steps"}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <MoneyInput label="Estimate" placeholder="Estimate" value={draft.estimatedPrice} onChange={(v) => set("estimatedPrice", v)} />
                <span className="text-sm text-ink-3">to</span>
                <MoneyInput label="Up to" placeholder="Up to" value={draft.estimateMax} onChange={(v) => set("estimateMax", v)} />
              </div>
            )}
            <label className="flex items-center gap-2.5 py-1 text-[14px] text-ink-2">
              <input
                type="checkbox"
                checked={draft.isQuote}
                onChange={(e) => set("isQuote", e.target.checked)}
                className="h-[18px] w-[18px] accent-[var(--accent)]"
              />
              We&apos;ve had a firm quote for this
            </label>
            {(draft.status === "DONE" || draft.actualPrice) && (
              <div className="grid grid-cols-[auto_1fr] items-center gap-3">
                <span className="text-[14px] font-medium text-ink">Paid</span>
                <MoneyInput label="Paid" placeholder="What it actually cost" value={draft.actualPrice} onChange={(v) => set("actualPrice", v)} />
              </div>
            )}
          </Field>

          {(draft.status === "DONE" || draft.warrantyUntil) && (
            <Field label="Guaranteed until" hint="The calendar feed reminds you a month before it runs out.">
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 5, 10].map((years) => {
                  // Counted from when it was finished (or today, if that's now).
                  const from = item?.completedAt ? toDayString(new Date(item.completedAt)) : today();
                  const day = addYears(from, years);
                  return (
                    <Chip
                      key={years}
                      selected={draft.warrantyUntil === day}
                      onClick={() => set("warrantyUntil", draft.warrantyUntil === day ? "" : day)}
                    >
                      {years} {years === 1 ? "year" : "years"}
                    </Chip>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={draft.warrantyUntil}
                  onChange={(e) => set("warrantyUntil", e.target.value)}
                  aria-label="Guaranteed until"
                  className={clsx(inputClass, "tabular")}
                />
                {draft.warrantyUntil && (
                  <Button variant="ghost" onClick={() => set("warrantyUntil", "")} className="shrink-0">
                    Clear
                  </Button>
                )}
              </div>
            </Field>
          )}

          {item && (
            <AskClaude
              item={item}
              canSetEstimate={!followsSteps && !draft.isQuote}
              onEstimate={applyEstimate}
              onAddSteps={addSuggestedSteps}
              onAddLink={addSuggestedLink}
            />
          )}

          {item && (
            <QuotesField
              item={item}
              onChosen={(u) => {
                const sync = (d: Draft): Draft => ({
                  ...d,
                  estimatedPrice: num(u.estimatedPrice),
                  estimateMax: num(u.estimateMax),
                  isQuote: u.isQuote,
                });
                setDraft(sync);
                setInitial(sync);
              }}
            />
          )}

          <StepsField
            steps={draft.steps}
            onChange={(steps) => set("steps", steps)}
            newStep={newStep}
            onNewStep={setNewStep}
            onAdd={addStep}
          />

          {item && <UpdatesField item={item} />}

          <LinksField
            links={draft.links}
            onChange={(links) => set("links", links)}
            newLink={newLink}
            onNewLink={setNewLink}
            onAdd={addLink}
          >
            {page.status === "loading" && (placeholderTitle || !draft.estimatedPrice.trim()) && (
              <span className="text-[12px] text-ink-3" aria-live="polite">
                Looking up that page…
              </span>
            )}
            {(offerPrice != null || offerTitle) && (
              <div className="flex min-w-0 flex-wrap gap-1.5" aria-live="polite">
                {offerPrice != null && (
                  <Suggestion onClick={() => set("estimatedPrice", String(offerPrice))}>
                    Use {formatGBP(offerPrice)} from {shop}
                  </Suggestion>
                )}
                {offerTitle && (
                  <Suggestion onClick={() => set("title", offerTitle.slice(0, TITLE_MAX))}>
                    Name it “{offerTitle}”
                  </Suggestion>
                )}
              </div>
            )}
          </LinksField>

          <Field label="Notes">
            <GrowingTextarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Measurements, colours, who quoted what…"
              aria-label="Notes"
              maxLength={4000}
              className={inputClass}
            />
          </Field>

          <Field label="Project" hint="Optional — group things like “Kitchen reno”.">
            <input
              value={draft.project}
              onChange={(e) => set("project", e.target.value)}
              list="projects"
              placeholder="None"
              aria-label="Project"
              maxLength={60}
              className={inputClass}
            />
            <datalist id="projects">
              {projects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>

          {item && (
            <p className="text-[13px] text-ink-3">
              Added by {item.addedBy} {timeAgo(item.createdAt)}
              {item.completedAt && (
                <>
                  {" · "}
                  {STATUS_LABELS[item.kind].DONE} {item.completedBy ? `by ${item.completedBy} ` : ""}on{" "}
                  {formatDay(toDayString(new Date(item.completedAt)))}
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {isNew ? (
          <Button variant="ghost" onClick={closeItem}>
            Cancel
          </Button>
        ) : (
          <>
            <Button
              variant="danger"
              onClick={() => {
                closeItem();
                removeItem(item!);
              }}
            >
              <Trash2 size={16} /> Delete
            </Button>
            <Button variant="ghost" onClick={duplicate}>
              <Copy size={16} /> Duplicate
            </Button>
          </>
        )}
        <Button onClick={save} className="ml-auto min-w-28">
          {isNew ? "Add" : dirty ? "Save" : "Close"}
        </Button>
      </div>
    </dialog>
  );
}

function nextSaturday() {
  const d = new Date();
  const diff = (6 - d.getDay() + 7) % 7;
  return toDayString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff));
}

function nextMonday() {
  const d = new Date();
  const diff = (1 - d.getDay() + 7) % 7 || 7;
  return toDayString(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff));
}
