"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUp, Calendar, Hammer, Plus, Repeat, ShoppingBag, SlidersHorizontal, User } from "lucide-react";
import type { Kind, Room } from "@/lib/types";
import { PRIORITY_LABELS, REPEAT_SHORT } from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";
import { parseQuickAdd } from "@/lib/parse";
import { describeDue, formatCost } from "@/lib/format";
import { useStore } from "@/lib/store";
import { PaintChip } from "@/components/ui";

type Props = {
  defaultRoom?: Room;
  defaultKind?: Kind;
  placeholder?: string;
};

const EXAMPLES = [
  "Fix bathroom tap £40 tomorrow !must",
  "Buy hallway runner £60–90 @Sam",
  "Book electrician by Friday !",
  "Paint spare room 1 next month",
];

export function QuickAdd({ defaultRoom, defaultKind, placeholder }: Props) {
  const { addItem, openItem, settings, openBulk, items } = useStore();
  const [text, setText] = useState("");
  const [kindOverride, setKindOverride] = useState<Kind | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, settings.members) : null), [text, settings.members]);
  const kind = kindOverride ?? (parsed && (parsed.kind === "BUY" || !defaultKind) ? parsed.kind : defaultKind) ?? "TASK";
  const room = parsed?.room ?? defaultRoom ?? null;

  function draft() {
    if (!parsed) return null;
    return {
      title: parsed.title,
      kind,
      room: room ?? undefined,
      priority: parsed.priority ?? undefined,
      estimatedPrice: parsed.estimatedPrice,
      estimateMax: parsed.estimateMax,
      dueDate: parsed.dueDate,
      assignee: parsed.assignee,
      repeat: parsed.repeat,
    };
  }

  // Pasting several lines (a list from Notes, a chat, a spreadsheet column)
  // turns each line into its own item, reviewed before adding.
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const lines = e.clipboardData
      .getData("text")
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*(?:[-*•–]|\d+[.)]|\[[ xX]?\])\s*/, "").trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    openBulk({
      title: `Add ${lines.length} things`,
      intro: "One per line from what you pasted. Untick anything you don't want.",
      candidates: lines.slice(0, 100).map((line) => {
        const p = parseQuickAdd(line, settings.members);
        return {
          title: p.title || line,
          kind: p.kind,
          room: p.room ?? defaultRoom,
          priority: p.priority ?? undefined,
          estimatedPrice: p.estimatedPrice,
          estimateMax: p.estimateMax,
          dueDate: p.dueDate,
          assignee: p.assignee,
          repeat: p.repeat,
        };
      }),
    });
  }

  function reset() {
    setText("");
    setKindOverride(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const d = draft();
    if (!d || !d.title) return;
    reset();
    inputRef.current?.focus();
    await addItem(d);
  }

  function moreDetails() {
    const d = draft();
    reset();
    openItem("new", d ? { ...d, room: d.room ?? defaultRoom } : { kind, room: defaultRoom });
  }

  const cost = parsed ? formatCost(parsed.estimatedPrice, parsed.estimateMax) : null;
  const duplicate = parsed?.title
    ? items.find((i) => i.status !== "DONE" && i.title.trim().toLowerCase() === parsed.title.toLowerCase())
    : undefined;
  const due = parsed?.dueDate ? describeDue(parsed.dueDate) : null;
  const showHint = focused && !text;

  return (
    <form onSubmit={submit} className="relative">
      <div
        className={clsx(
          "rounded-2xl border bg-surface transition-[border-color,box-shadow] duration-150",
          focused ? "border-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]" : "border-line",
        )}
      >
        <div className="flex items-center gap-2 py-1.5 pr-1.5 pl-3.5">
          <Plus size={20} strokeWidth={2.25} className="shrink-0 text-accent" aria-hidden="true" />
          <input
            ref={inputRef}
            id="quick-add"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => e.key === "Escape" && (reset(), inputRef.current?.blur())}
            placeholder={placeholder ?? "Add a job or something to buy…"}
            aria-label="Add a job or something to buy"
            aria-describedby="quick-add-help"
            autoComplete="off"
            enterKeyHint="done"
            className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-ink outline-none"
          />
          {text ? (
            <button
              type="submit"
              aria-label="Add it"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-transform duration-150 hover:bg-accent-hover active:scale-90"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          ) : (
            <button
              type="button"
              onClick={moreDetails}
              aria-label="Add with all the details"
              title="Add with all the details"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
            >
              <SlidersHorizontal size={17} strokeWidth={2} />
            </button>
          )}
        </div>

        {parsed && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2 text-[12.5px]">
            <button
              type="button"
              onClick={() => setKindOverride(kind === "BUY" ? "TASK" : "BUY")}
              className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 font-semibold text-ink transition-colors hover:bg-line"
              title="Switch between a job and something to buy"
            >
              {kind === "BUY" ? <ShoppingBag size={13} strokeWidth={2.2} /> : <Hammer size={13} strokeWidth={2.2} />}
              {kind === "BUY" ? "To buy" : "Job"}
            </button>
            {room && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 font-medium text-ink-2">
                <PaintChip room={room} className="!h-2.5 !w-2.5" />
                {ROOM_PAINT[room].label}
              </span>
            )}
            {parsed.priority && (
              <span className="rounded-full bg-sunken px-2.5 py-1 font-semibold text-ink">
                {PRIORITY_LABELS[parsed.priority]}
              </span>
            )}
            {cost && <span className="rounded-full bg-sunken px-2.5 py-1 font-semibold text-ink tabular">{cost}</span>}
            {due && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 font-medium text-ink-2">
                <Calendar size={12} strokeWidth={2.2} aria-hidden="true" />
                {due.label}
              </span>
            )}
            {parsed.repeat && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 font-medium text-ink-2">
                <Repeat size={12} strokeWidth={2.2} aria-hidden="true" />
                {REPEAT_SHORT[parsed.repeat]}
              </span>
            )}
            {parsed.assignee && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 font-medium text-ink-2">
                <User size={12} strokeWidth={2.2} aria-hidden="true" />
                {parsed.assignee}
              </span>
            )}
            {duplicate && (
              <button
                type="button"
                onClick={() => {
                  reset();
                  openItem(duplicate.id);
                }}
                className="rounded-full bg-warn-soft px-2.5 py-1 font-semibold text-warn"
                title="Open the one that's already there"
              >
                Already on the list
              </button>
            )}
            <button
              type="button"
              onClick={moreDetails}
              className="ml-auto rounded-full px-2 py-1 font-semibold text-accent-text hover:bg-accent-soft"
            >
              More details
            </button>
          </div>
        )}
      </div>

      <p
        id="quick-add-help"
        className={clsx(
          "px-1 pt-2 text-[12.5px] text-ink-3 transition-opacity duration-150",
          showHint ? "opacity-100" : "sr-only",
        )}
      >
        Try “{EXAMPLES[new Date().getDate() % EXAMPLES.length]}”. Use £ for cost, ! for a must, @ for who, # for a room. Paste a list to add lots at once.
      </p>
    </form>
  );
}
