"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, Plus, Settings } from "lucide-react";
import { useStore } from "@/lib/store";
import { ROOMS, type ItemDTO } from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";
import { greeting, toDayString, today } from "@/lib/format";
import { listLines } from "@/lib/printouts";
import { PaintChip, TickButton } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { RecentPrintOuts } from "@/components/RecentPrintOuts";

/**
 * The simple layout: the house as one paper-like checklist, room by room, in
 * the order things were written down. Ticked things stay crossed out until
 * tomorrow, so the day's work stays in sight. Everything else (money, plans,
 * priorities, Claude) lives in the full layout.
 */
export function SimpleHome({ onAdd, onSettings }: { onAdd: () => void; onSettings: () => void }) {
  const { items, me } = useStore();
  const day = today();
  const doneToday = (i: ItemDTO) => i.status === "DONE" && !!i.completedAt && toDayString(new Date(i.completedAt)) === day;
  const shown = items.filter((i) => i.status !== "DONE" || doneToday(i));
  const groups = ROOMS.map((room) => ({
    room,
    items: shown.filter((i) => i.room === room).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
  })).filter((g) => g.items.length);
  const left = shown.filter((i) => i.status !== "DONE");
  const ticked = shown.length - left.length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.025em]">
            {greeting()}, {me}
          </h1>
          <p className="mt-1 text-[15px] text-ink-2">
            {left.length ? `${left.length} to do` : "Nothing left to do"}
            {ticked > 0 && ` · ${ticked} done today`}
          </p>
        </div>
        <button
          type="button"
          onClick={onSettings}
          aria-label="Settings"
          className="hit -mr-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <Settings size={21} />
        </button>
      </header>

      <RecentPrintOuts />

      {groups.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center"
        >
          <span className="text-[17px] font-semibold text-ink">The list is empty</span>
          <span className="text-[15px] text-ink-2">Tap here, or Add below, to write the first thing.</span>
        </button>
      ) : (
        groups.map((g) => {
          const open = g.items.filter((i) => i.status !== "DONE");
          return (
            <section key={g.room} aria-labelledby={`room-${g.room}`}>
              <h2 id={`room-${g.room}`} className="flex min-h-10 items-center justify-between gap-3 px-1">
                <span className="inline-flex items-center gap-2 text-[17px] font-bold text-ink">
                  <PaintChip room={g.room} />
                  {ROOM_PAINT[g.room].label}
                </span>
                {open.length > 0 && (
                  <PrintButton
                    title={ROOM_PAINT[g.room].label}
                    lines={() => listLines([{ label: null, items: open }])}
                    className="-mr-2 text-[13px]"
                  />
                )}
              </h2>
              <ul className="border-t border-line">
                {g.items.map((item) => (
                  <SimpleRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      {left.length > 0 && (
        <PrintButton
          title="Our list"
          label="Print the whole list"
          lines={() =>
            listLines(
              groups.map((g) => ({
                label: ROOM_PAINT[g.room].label,
                items: g.items.filter((i) => i.status !== "DONE"),
              })),
            )
          }
          className="justify-self-center"
        />
      )}

      {/* The one way in: big, at the thumb. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/92 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-lg">
        <button
          type="button"
          onClick={onAdd}
          className="mx-auto flex h-14 w-full max-w-[520px] items-center justify-center gap-2 rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink shadow-pop transition-transform duration-150 active:scale-[0.98]"
        >
          <Plus size={22} strokeWidth={2.4} /> Add something
        </button>
      </div>
    </div>
  );
}

/** One line of the checklist: tick it, open it, and (for a job with steps) unfold its own little list. */
function SimpleRow({ item }: { item: ItemDTO }) {
  const { toggleDone, toggleStep, openItem } = useStore();
  const [unfolded, setUnfolded] = useState(false);
  const done = item.status === "DONE";
  const stepsDone = item.steps.filter((s) => s.done).length;

  return (
    <li className="border-b border-line">
      <div className="flex items-start gap-3 px-1 py-3">
        <TickButton done={done} room={item.room} label={item.title} onToggle={() => toggleDone(item)} size="lg" />
        <div className="min-w-0 flex-1 pt-1">
          <button
            type="button"
            onClick={() => openItem(item.id)}
            className={clsx(
              "block w-full text-left text-[17px] leading-snug",
              done ? "text-ink-3 line-through decoration-ink-3/60" : "font-medium text-ink",
            )}
          >
            {item.title}
          </button>
          {item.steps.length > 0 && !done && (
            <button
              type="button"
              onClick={() => setUnfolded((u) => !u)}
              aria-expanded={unfolded}
              className="mt-0.5 -ml-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-[14px] text-ink-2 hover:text-ink"
            >
              {stepsDone} of {item.steps.length} steps
              <ChevronDown size={16} className={clsx("transition-transform", unfolded && "rotate-180")} aria-hidden="true" />
            </button>
          )}
          {unfolded && !done && (
            <ul className="mt-1 grid">
              {item.steps.map((step) => (
                <li key={step.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={step.done}
                    onClick={() => toggleStep(item, step.id)}
                    className="flex min-h-11 w-full items-center gap-3 text-left text-[15px]"
                  >
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors",
                        step.done ? "border-accent bg-accent text-accent-ink" : "border-tick-ring",
                      )}
                    >
                      {step.done && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className={step.done ? "text-ink-3 line-through" : "text-ink"}>{step.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
