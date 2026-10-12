"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUp, Calendar, Hammer, Link2, LoaderCircle, Plus, Repeat, ShoppingBag, SlidersHorizontal, Sparkles, User } from "lucide-react";
import type { Kind, Room } from "@/lib/types";
import { PRIORITY_LABELS, REPEAT_SHORT, TITLE_MAX } from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";
import { guessRoom, parseQuickAdd, pastedLines, sameThing, startsWithJobWord } from "@/lib/parse";
import { readableLink, siteOf, splitLink, titleFromUrl } from "@/lib/unfurl";
import { unfurlLink, useUnfurl } from "@/lib/useUnfurl";
import { describeDue, formatCost } from "@/lib/format";
import { useStore } from "@/lib/store";
import { workerState } from "@/lib/ai";
import { PaintChip } from "@/components/ui";

type Props = {
  defaultRoom?: Room;
  defaultKind?: Kind;
  placeholder?: string;
};

const LINE_MAX = 2000;

const EXAMPLES = [
  "Fix bathroom tap £40 tomorrow !must",
  "Buy hallway runner £60–90 @Sam",
  "Book electrician by Friday !",
  "Paint spare room 1 next month",
];

export function QuickAdd({ defaultRoom, defaultKind, placeholder }: Props) {
  const { addItem, patchItem, openItem, settings, openBulk, items, askClaude, toast } = useStore();
  const [text, setText] = useState("");
  const [kindOverride, setKindOverride] = useState<Kind | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // A product link anywhere in the line is read for its name and price while
  // the rest of the line is parsed as usual, so "!must #kitchen" still work.
  const { url: link, rest } = useMemo(() => splitLink(text), [text]);
  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(rest, settings.members) : null),
    [text, rest, settings.members],
  );
  const page = useUnfurl(link);
  // Only offered once a worker has ever checked in, so nobody queues into nothing.
  const worker = workerState(settings.workerSeenAt);
  // A link makes it something to buy, unless it's typed as a job that
  // happens to come with one: "Install fire alarms <link to the alarms>".
  const kind =
    kindOverride ??
    (link && !startsWithJobWord(parsed?.title ?? "")
      ? "BUY"
      : parsed && (parsed.kind === "BUY" || !defaultKind)
        ? parsed.kind
        : defaultKind) ??
    "TASK";
  // What the user typed wins; the page fills the gaps, then the link itself.
  const title = parsed ? (parsed.title || page.data?.title || (link ? titleFromUrl(link) : "")).slice(0, TITLE_MAX) : "";
  const price = parsed?.estimatedPrice ?? page.data?.price ?? null;
  const room = parsed?.room ?? defaultRoom ?? (link ? guessRoom(title) : null);

  function draft() {
    if (!parsed) return null;
    return {
      title,
      kind,
      room: room ?? undefined,
      priority: parsed.priority ?? undefined,
      estimatedPrice: price,
      estimateMax: parsed.estimateMax,
      dueDate: parsed.dueDate,
      assignee: parsed.assignee,
      repeat: parsed.repeat,
      links: link ? [page.data?.url ?? link] : undefined,
    };
  }

  // Pasting several lines (a list from Notes, a chat, a spreadsheet column)
  // turns each line into its own item, reviewed before adding.
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const lines = pastedLines(e.clipboardData.getData("text"));
    if (lines.length < 2) return;
    e.preventDefault();
    // A product shared from a shop's app arrives as its name and its link on
    // two lines: that's one thing, not two.
    if (lines.length === 2 && lines.filter((l) => readableLink(l)).length === 1) {
      setText((t) => [t.trim(), ...lines].filter(Boolean).join(" ").slice(0, LINE_MAX));
      return;
    }
    openBulk({
      title: `Add ${lines.length} things`,
      intro: "One per line from what you pasted. Untick anything you don't want.",
      candidates: lines.slice(0, 100).map((line) => {
        const { url, rest } = splitLink(line);
        const p = parseQuickAdd(rest, settings.members);
        return {
          title: (p.title || (url ? titleFromUrl(url) : line)).slice(0, TITLE_MAX),
          kind: url && !startsWithJobWord(p.title) ? "BUY" : p.kind,
          room: p.room ?? defaultRoom,
          priority: p.priority ?? undefined,
          estimatedPrice: p.estimatedPrice,
          estimateMax: p.estimateMax,
          dueDate: p.dueDate,
          assignee: p.assignee,
          repeat: p.repeat,
          links: url ? [url] : undefined,
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
    // Adding never waits on a slow shop: it goes in now with the link's own
    // name, and the page's name and price follow when they arrive.
    const reading = link && page.status === "loading" ? unfurlLink(link) : null;
    const created = await addItem(d);
    if (!created || !reading) return;
    const found = await reading;
    if (!found) return;
    const upgrade = {
      title: !parsed?.title && found.title ? found.title.slice(0, TITLE_MAX) : undefined,
      estimatedPrice: d.estimatedPrice == null && found.price != null ? found.price : undefined,
      room: !d.room && found.title ? (guessRoom(found.title) ?? undefined) : undefined,
    };
    if (Object.values(upgrade).some((v) => v !== undefined)) await patchItem(created.id, upgrade);
  }

  // Hands the line to Claude: it's added now as typed, and the worker fills in
  // the cost, steps, links and notes when it answers. If it's already on the
  // list, Claude fills in that one instead of adding it twice.
  async function addWithClaude() {
    const d = draft();
    if (!d || !d.title) return;
    reset();
    inputRef.current?.focus();
    const target =
      duplicate ??
      // A job's cost is Claude's to work out: a linked product's price is
      // one thing it needs, not the whole job.
      (await addItem(kind === "TASK" && parsed?.estimatedPrice == null ? { ...d, estimatedPrice: null } : d));
    if (!target) return;
    if (await askClaude(target.id, undefined, { autofill: true })) {
      const later = worker === "active" ? "Claude's filling in the details." : "Claude will fill in the details when the worker's next on.";
      toast({
        message: duplicate ? `Already on the list. ${later}` : `Added. ${later}`,
        ...(duplicate ? { action: { label: "Open", run: () => openItem(duplicate.id) } } : {}),
      });
    }
  }

  function moreDetails() {
    const d = draft();
    reset();
    openItem("new", d ? { ...d, room: d.room ?? defaultRoom } : { kind, room: defaultRoom });
  }

  const cost = parsed ? formatCost(price, parsed.estimateMax) : null;
  const duplicate = title ? items.find((i) => i.status !== "DONE" && sameThing(i.title, title)) : undefined;
  const site = link ? (page.data?.siteName ?? siteOf(link)) : null;
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
        <div className="flex items-center gap-2 py-1 pr-1 pl-3.5">
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
            // Room for a long shop link; the title itself is cut to TITLE_MAX.
            maxLength={LINE_MAX}
            aria-describedby="quick-add-help"
            autoComplete="off"
            enterKeyHint="done"
            className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-ink outline-none"
          />
          {text && worker !== "never" && (
            <button
              type="button"
              onClick={addWithClaude}
              aria-label="Add it and ask Claude to fill in the details"
              title="Add it and ask Claude to fill in the details"
              className="mr-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-accent-text transition-colors hover:bg-accent-soft active:scale-90"
            >
              <Sparkles size={17} strokeWidth={2.2} />
            </button>
          )}
          {text ? (
            <button
              type="submit"
              aria-label="Add it"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition-transform duration-150 hover:bg-accent-hover active:scale-90"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          ) : (
            <button
              type="button"
              onClick={moreDetails}
              aria-label="Add with all the details"
              title="Add with all the details"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
            >
              <SlidersHorizontal size={17} strokeWidth={2} />
            </button>
          )}
        </div>

        {parsed && link && (
          // What a pasted link will add as, so the box can stay showing the link.
          <div className="flex min-w-0 items-center gap-2 border-t border-line px-3.5 pt-2 text-[13px]">
            {page.status === "loading" ? (
              <LoaderCircle size={14} strokeWidth={2.4} className="shrink-0 animate-spin text-ink-3" aria-hidden="true" />
            ) : (
              <Link2 size={14} strokeWidth={2.4} className="shrink-0 text-ink-3" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{title}</span>
            <span aria-live="polite" className="shrink-0 text-ink-3">
              {page.status === "loading" ? `Reading ${site}…` : page.status === "failed" ? `${site} · couldn’t read it` : site}
            </span>
          </div>
        )}

        {parsed && (
          <div
            className={clsx(
              "chips-pop flex flex-wrap items-center gap-1.5 px-3 py-2 text-[12.5px]",
              !link && "border-t border-line",
            )}
          >
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

      {/* Floats over what's below, so focusing or leaving the box never shifts the page under a tap. */}
      <p
        id="quick-add-help"
        className={clsx(
          "text-[12.5px] text-ink-2",
          showHint
            ? "pointer-events-none absolute inset-x-0 top-full z-20 mt-1.5 rounded-xl border border-line bg-surface px-3 py-2 shadow-pop"
            : "sr-only",
        )}
      >
        Try “{EXAMPLES[new Date().getDate() % EXAMPLES.length]}”. Use £ for cost, ! for a must, @ for who, # for a room. Paste a list to add lots at once, or a shop link for its name and price.
      </p>
    </form>
  );
}
