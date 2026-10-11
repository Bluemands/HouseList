"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Calendar,
  Check,
  ListChecks,
  MessageSquare,
  Pin,
  Receipt,
  Repeat,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import type { ItemDTO } from "@/lib/types";
import { REPEAT_SHORT, STATUS_LABELS } from "@/lib/types";
import { describeDue, formatCost, formatGBP, formatMonth, formatMonthYear, today } from "@/lib/format";
import { useStore } from "@/lib/store";
import { haptic } from "@/lib/haptics";
import { doneStepsCost } from "@/lib/pot";
import { PriorityTag, RoomTag, TickButton } from "@/components/ui";
import { Chappie } from "@/components/Chappie";

type Props = {
  item: ItemDTO;
  /** Months until the pot covers it (0 = now, null = not at current saving). */
  monthsAway?: number | null;
  hideRoom?: boolean;
  lead?: boolean;
  /** Selection mode: a tap selects the row instead of opening it. */
  select?: { selected: boolean; onToggle: () => void };
};

const SWIPE_COMMIT = 96;
const SWIPE_MAX = 140;

/**
 * On a phone a row can be swiped: right to finish (or reopen), left to
 * delete. Both land with an undo toast, so a misfire costs nothing.
 */
function useSwipe(onRight: () => void, onLeft: () => void) {
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);
  const drag = useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const swiped = useRef(false);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      drag.current = { x: e.clientX, y: e.clientY, axis: null };
      swiped.current = false;
      setSettling(false);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;
      const mx = e.clientX - d.x;
      const my = e.clientY - d.y;
      if (!d.axis) {
        if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.4) {
          d.axis = "x";
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // The pointer can already be gone (lifted mid-gesture); the swipe still works without capture.
          }
        } else if (Math.abs(my) > 10) {
          drag.current = null; // a scroll, not a swipe
          return;
        }
      }
      if (d.axis === "x") {
        swiped.current = true;
        const next = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, mx));
        // A tap the moment a swipe would count, so letting go is a decision.
        if (Math.abs(next) >= SWIPE_COMMIT && Math.abs(dx) < SWIPE_COMMIT) haptic(6);
        setDx(next);
      }
    },
    onPointerUp: () => {
      if (!drag.current) return;
      drag.current = null;
      setSettling(true);
      if (dx >= SWIPE_COMMIT) onRight();
      else if (dx <= -SWIPE_COMMIT) onLeft();
      setDx(0);
    },
    onPointerCancel: () => {
      drag.current = null;
      setSettling(true);
      setDx(0);
    },
    // A swipe that ends over the row shouldn't also open it.
    onClickCapture: (e: React.MouseEvent) => {
      if (swiped.current) {
        e.preventDefault();
        e.stopPropagation();
        swiped.current = false;
      }
    },
  };
  return { dx, settling, handlers };
}

export function ItemRow({ item: listed, monthsAway, hideRoom, lead, select }: Props) {
  const { toggleDone, toggleStep, openItem, removeItem, justAdded, settling, itemById, jobByItem } = useStore();
  // Just ticked: the list still holds its place, but the row shows it done.
  const leaving = settling.has(listed.id);
  const item = leaving ? (itemById.get(listed.id) ?? listed) : listed;
  const done = item.status === "DONE";
  const swipe = useSwipe(
    () => toggleDone(item),
    () => removeItem(item),
  );
  const due = item.dueDate && !done ? describeDue(item.dueDate) : null;
  const stepsDone = item.steps.filter((s) => s.done).length;
  const nextStep = done || select ? undefined : item.steps.find((s) => !s.done);
  const stagesPaid = done ? 0 : doneStepsCost(item.steps);
  const cost = done
    ? item.actualPrice != null
      ? formatGBP(item.actualPrice)
      : null
    : formatCost(item.estimatedPrice, item.estimateMax);
  const openQuotes = !done && !item.isQuote ? item.quotes.length : 0;

  // An answer that lands while the row is on screen gets a moment: noticed
  // as the job moves on from waiting, not on every visit.
  const job = jobByItem.get(item.id);
  const [jobSeen, setJobSeen] = useState(job?.status);
  const [answered, setAnswered] = useState(false);
  if (jobSeen !== job?.status) {
    setJobSeen(job?.status);
    if ((jobSeen === "QUEUED" || jobSeen === "RUNNING") && job?.status === "DONE") setAnswered(true);
  }

  // A change that lands on a row already showing (saved from the sheet, or
  // made on the other phone) washes it briefly, so it's seen to happen.
  const rowRef = useRef<HTMLLIElement>(null);
  const updated = useRef(item.updatedAt);
  useEffect(() => {
    if (updated.current === item.updatedAt) return;
    updated.current = item.updatedAt;
    const row = rowRef.current;
    if (!row || leaving || justAdded === item.id) return;
    const wash = getComputedStyle(row).getPropertyValue("--accent-soft").trim();
    row.animate([{ backgroundColor: wash }, { backgroundColor: "transparent" }], {
      duration: 1400,
      easing: "cubic-bezier(0.33, 1, 0.68, 1)",
    });
  }, [item.updatedAt, item.id, leaving, justAdded]);

  const meta: React.ReactNode[] = [];
  if (!hideRoom) meta.push(<RoomTag key="room" room={item.room} />);
  if (item.status === "DOING") {
    meta.push(
      <span key="status" className="font-semibold text-accent-text">
        {STATUS_LABELS[item.kind].DOING}
      </span>,
    );
  }
  if (due) {
    meta.push(
      <span
        key="due"
        className={clsx(
          "inline-flex items-center gap-1",
          due.tone === "overdue" && "font-semibold text-danger",
          due.tone === "soon" && "font-medium text-ink",
        )}
      >
        <Calendar
          size={12}
          strokeWidth={2.2}
          className={due.tone === "overdue" ? undefined : "text-ink-3"}
          aria-hidden="true"
        />
        {due.label}
      </span>,
    );
  }
  if (item.assignee) {
    meta.push(
      <span key="who" className="inline-flex items-center gap-1">
        <User size={12} strokeWidth={2.2} className="text-ink-3" aria-hidden="true" />
        {item.assignee}
      </span>,
    );
  }
  if (item.repeat && !done) {
    meta.push(
      <span key="repeat" className="inline-flex items-center gap-1">
        <Repeat size={12} strokeWidth={2.2} className="text-ink-3" aria-hidden="true" />
        {REPEAT_SHORT[item.repeat]}
      </span>,
    );
  }
  if (item.steps.length) {
    meta.push(
      <span key="steps" className="inline-flex items-center gap-1 tabular">
        <ListChecks size={13} strokeWidth={2} aria-hidden="true" />
        {stepsDone}/{item.steps.length}
        <span className="sr-only">steps done</span>
      </span>,
    );
  }
  if (stagesPaid > 0) {
    meta.push(
      <span key="paid" className="tabular">
        {formatGBP(stagesPaid)} paid
      </span>,
    );
  }
  if (openQuotes) {
    meta.push(
      <span key="quotes" className="inline-flex items-center gap-1 tabular">
        <Receipt size={12} strokeWidth={2.2} className="text-ink-3" aria-hidden="true" />
        {openQuotes} {openQuotes === 1 ? "quote" : "quotes"}
      </span>,
    );
  }
  if (item.comments.length) {
    meta.push(
      <span key="comments" className="inline-flex items-center gap-1 tabular">
        <MessageSquare size={12} strokeWidth={2.2} className="text-ink-3" aria-hidden="true" />
        {item.comments.length}
        <span className="sr-only">{item.comments.length === 1 ? "update" : "updates"}</span>
      </span>,
    );
  }
  // Claude has answered and nobody's looked yet: a nudge to open it.
  if (job?.status === "DONE") {
    meta.push(
      <span
        key="claude-done"
        className={clsx("inline-flex items-center gap-1 font-medium text-accent-text", answered && "claude-arrive")}
      >
        <Sparkles size={12} strokeWidth={2.2} aria-hidden="true" />
        Suggestion
        <span className="sr-only">from Claude ready</span>
      </span>,
    );
  } else if (job?.status === "QUEUED" || job?.status === "RUNNING") {
    // Out with Claude: Chappie looks about until a worker takes it, then gets to work.
    const working = job.status === "RUNNING";
    meta.push(
      <span key="claude" className={clsx("inline-flex items-center gap-1 font-medium", working ? "text-accent-text" : "text-ink-3")}>
        <Chappie working={working} size={16} className="-my-1" />
        {working ? (job.autofill ? "Claude's filling this in" : "Claude's on it") : "Waiting for Claude"}
      </span>,
    );
  }
  if (done && item.completedBy) meta.push(<span key="by">{item.completedBy}</span>);
  if (item.warrantyUntil && item.warrantyUntil >= today()) {
    meta.push(
      <span key="guarantee" className="inline-flex items-center gap-1">
        <ShieldCheck size={12} strokeWidth={2.2} className="text-ink-3" aria-hidden="true" />
        Guaranteed to {formatMonthYear(item.warrantyUntil)}
      </span>,
    );
  }

  const reveal = Math.min(1, Math.abs(swipe.dx) / SWIPE_COMMIT);
  const armed = Math.abs(swipe.dx) >= SWIPE_COMMIT;

  return (
    <li
      ref={rowRef}
      className={clsx(
        "relative grid touch-pan-y grid-rows-[1fr] overflow-hidden border-b border-line",
        justAdded === item.id && "row-arrive",
        leaving && "row-leave",
      )}
      {...(select ? {} : swipe.handlers)}
    >
      {/* What a swipe will do, revealed underneath the row. */}
      {swipe.dx !== 0 && (
        <div
          aria-hidden="true"
          className={clsx(
            "absolute inset-0 flex items-center px-5 text-[14px] font-semibold",
            swipe.dx > 0 ? "justify-start bg-accent text-accent-ink" : "justify-end bg-danger text-white",
          )}
          style={{ opacity: 0.35 + reveal * 0.65 }}
        >
          {swipe.dx > 0 ? (
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 transition-transform duration-150",
                armed && "scale-110",
              )}
            >
              <Check size={18} strokeWidth={2.6} /> {done ? "Reopen" : "Done"}
            </span>
          ) : (
            <span
              className={clsx(
                "inline-flex items-center gap-1.5 transition-transform duration-150",
                armed && "scale-110",
              )}
            >
              Delete <Trash2 size={17} />
            </span>
          )}
        </div>
      )}

      {/* The grid row folds to nothing when a ticked row leaves. */}
      <div className="min-h-0">
        <div
          className={clsx(
            "group relative flex items-start gap-3 transition-colors duration-150",
            select?.selected ? "bg-accent-soft" : "bg-bg hover:bg-sunken/60",
            lead ? "px-1 py-4" : "px-1 py-3",
            swipe.settling && "transition-transform duration-200 ease-out",
          )}
          style={swipe.dx ? { transform: `translateX(${swipe.dx}px)` } : undefined}
        >
          <div className={clsx("relative z-10", lead ? "pt-0.5" : "pt-px")}>
            {select ? (
              <span
                aria-hidden="true"
                className={clsx(
                  "grid place-items-center rounded-[8px] border-[1.5px] transition-colors",
                  lead ? "h-8 w-8" : "h-[26px] w-[26px]",
                  select.selected ? "border-accent bg-accent text-accent-ink" : "border-line-strong",
                )}
              >
                {select.selected && <Check size={lead ? 18 : 15} strokeWidth={2.8} />}
              </span>
            ) : (
              <TickButton
                done={done}
                room={item.room}
                label={item.title}
                onToggle={() => toggleDone(item)}
                size={lead ? "lg" : "md"}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => (select ? select.onToggle() : openItem(item.id))}
              aria-pressed={select ? select.selected : undefined}
              className="block w-full text-left outline-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
            >
              <span className="flex items-start gap-2">
                <span
                  className={clsx(
                    "min-w-0 flex-1 leading-snug",
                    lead ? "text-[18px] font-semibold tracking-[-0.01em]" : "text-[15px] font-medium",
                    done ? "text-ink-3 line-through decoration-ink-3/50" : "text-ink",
                  )}
                >
                  {item.pinned && !done && (
                    <Pin
                      size={lead ? 15 : 13}
                      strokeWidth={2.4}
                      className="mr-1.5 inline-block -translate-y-px fill-current align-baseline text-accent-text"
                      aria-label="Pinned"
                    />
                  )}
                  {item.title}
                </span>
                {cost && (
                  <span
                    className={clsx("shrink-0 pt-px text-[14px] tabular", done ? "text-ink-3" : "font-medium text-ink")}
                  >
                    {item.isQuote && !done && <span className="mr-1 text-[11px] font-semibold text-ink-3">QUOTE</span>}
                    {cost}
                  </span>
                )}
              </span>
  
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
                {!done && <PriorityTag priority={item.priority} />}
                {item.kind === "BUY" && (
                  <ShoppingBag size={13} strokeWidth={2} className="text-ink-3" aria-label="To buy" />
                )}
                {meta}
                {!done && monthsAway !== undefined && monthsAway !== 0 && (
                  <span className="ml-auto text-[12px] text-ink-3">
                    {/* null: the pot can't cover it and there's no monthly saving to wait for. */}
                    {monthsAway !== null ? `Affordable ${formatMonth(monthsAway, false)}` : "Not affordable yet"}
                  </span>
                )}
              </span>
            </button>
            {/* The next step, tickable without opening the item. */}
            {nextStep && (
              <span className="relative z-10 mt-1.5 flex max-w-full items-center gap-2 text-[13px] text-ink-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={false}
                  aria-label={`Mark step “${nextStep.text}” as done`}
                  onClick={() => toggleStep(item, nextStep.id)}
                  className="-m-2 grid shrink-0 place-items-center p-2"
                >
                  <span className="h-[15px] w-[15px] rounded-[4px] border-[1.5px] border-line-strong transition-colors hover:border-accent" />
                </button>
                <span className="min-w-0 truncate">
                  <span className="text-ink-3">Next: </span>
                  {nextStep.text}
                </span>
                {nextStep.cost != null && nextStep.cost > 0 && (
                  <span className="shrink-0 text-ink-3 tabular">{formatGBP(nextStep.cost)}</span>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function ItemList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={clsx("relative border-t border-line", className)}>{children}</ul>;
}
