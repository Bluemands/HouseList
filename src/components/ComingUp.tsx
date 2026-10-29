"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { ChevronRight, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useOpenCalendar } from "@/lib/calendar-nav";
import { addDays, today } from "@/lib/format";
import { calendarDays, formatTime, type CalEntry } from "@/lib/events";
import { ROOM_PAINT } from "@/lib/rooms";
import { PaintChip, SectionHead } from "@/components/ui";

// On both home screens: the week ahead from the calendar, as a strip of days
// and then what's on, events and dated jobs together. Bins have their own
// notice, so they're left to the calendar.

const SHOWN = 6;

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" });
const weekdayShort = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

/** "Today", "Tomorrow", "Sat 8". */
export function dayName(day: string, now = today()): string {
  if (day === now) return "Today";
  if (day === addDays(now, 1)) return "Tomorrow";
  return weekday.format(new Date(`${day}T12:00:00`));
}

/** A dot for an event; a room's paint for a job. */
export function EntryMark({ entry }: { entry: Exclude<CalEntry, { kind: "bins" }> }) {
  return entry.kind === "event" ? (
    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-ink" />
  ) : (
    <PaintChip room={entry.item.room} className="!h-2.5 !w-2.5 shrink-0" />
  );
}

export function ComingUp() {
  const { events, items } = useStore();
  const open = useOpenCalendar();
  const now = today();
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(now, i)), [now]);
  const days = useMemo(() => {
    const out: [string, Exclude<CalEntry, { kind: "bins" }>[]][] = [];
    for (const [day, entries] of calendarDays({ events, items, bins: [] }, now, addDays(now, 6))) {
      // Something running over several days is mentioned the day it starts (or today, if it's already on).
      const fresh = entries.filter(
        (e): e is Exclude<CalEntry, { kind: "bins" }> => e.kind !== "bins" && (e.kind !== "event" || e.start === day || day === now),
      );
      if (fresh.length) out.push([day, fresh]);
    }
    return out;
  }, [events, items, now]);
  const total = days.reduce((n, [, entries]) => n + entries.length, 0);

  // Whole days, until the next would go past what fits.
  const shown: typeof days = [];
  let count = 0;
  for (const day of days) {
    if (shown.length && count + day[1].length > SHOWN) break;
    shown.push(day);
    count += day[1].length;
  }
  const hidden = total - count;
  const on = new Map(days);

  return (
    <section aria-labelledby="coming-head">
      <SectionHead id="coming-head" title="This week">
        <button
          type="button"
          onClick={() => open()}
          className="inline-flex items-center gap-0.5 text-supporting font-semibold text-accent-text hover:underline"
        >
          Calendar <ChevronRight size={16} />
        </button>
      </SectionHead>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {/* The next seven days, so it reads as a calendar at a glance. */}
        <div className="grid grid-cols-7 px-1.5 py-2">
          {week.map((day) => {
            const entries = on.get(day) ?? [];
            const isToday = day === now;
            return (
              <button
                key={day}
                type="button"
                onClick={() => open(day)}
                aria-label={`${dayName(day, now)}${entries.length ? `, ${entries.length} on` : ""}`}
                className="flex flex-col items-center gap-1 rounded-control py-1 transition-colors hover:bg-sunken"
              >
                <span className={clsx("text-label font-semibold", isToday ? "text-accent-text" : "text-ink-3")}>
                  {weekdayShort.format(new Date(`${day}T12:00:00`))}
                </span>
                <span
                  className={clsx(
                    "grid h-8 w-8 place-items-center rounded-full text-supporting tabular",
                    isToday ? "bg-accent font-semibold text-accent-ink" : "text-ink",
                  )}
                >
                  {Number(day.slice(8))}
                </span>
                <span aria-hidden="true" className="flex h-1.5 gap-0.5">
                  {entries.slice(0, 3).map((e, i) =>
                    e.kind === "event" ? (
                      <span key={i} className="h-1.5 w-1.5 rounded-full bg-ink" />
                    ) : (
                      <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: ROOM_PAINT[e.item.room].hex }} />
                    ),
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {shown.length > 0 && (
          <ul className="divide-y divide-line border-t border-line">
            {shown.map(([day, entries]) => (
              <li key={day}>
                <button
                  type="button"
                  onClick={() => open(day)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-sunken"
                >
                  <span className="w-[4.5rem] shrink-0 pt-px text-meta font-semibold text-ink-2">{dayName(day, now)}</span>
                  <span className="grid min-w-0 flex-1 gap-1">
                    {entries.map((e) => (
                      <span key={e.kind === "event" ? `e:${e.event.id}` : `i:${e.item.id}`} className="flex min-w-0 items-center gap-2">
                        <EntryMark entry={e} />
                        <span className="min-w-0 flex-1 truncate text-supporting text-ink">
                          {e.kind === "event" ? e.event.title : e.item.title}
                        </span>
                        {e.kind === "event" && e.event.time && (
                          <span className="shrink-0 text-meta text-ink-3 tabular">{formatTime(e.event.time)}</span>
                        )}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3 border-t border-line px-4 py-2">
          <span className="min-w-0 flex-1 text-meta text-ink-2">
            {total === 0 ? "Nothing on. Birthdays, gigs, family dos…" : hidden > 0 ? `${hidden} more this week` : null}
          </span>
          <button
            type="button"
            onClick={() => open(now, true)}
            className="-mr-2 inline-flex shrink-0 items-center gap-1 rounded-control px-2 py-1.5 text-supporting font-semibold text-accent-text hover:bg-sunken"
          >
            <Plus size={16} strokeWidth={2.4} /> Add event
          </button>
        </div>
      </div>
    </section>
  );
}
