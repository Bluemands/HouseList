"use client";

import { useMemo } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { useOpenCalendar } from "@/lib/calendar-nav";
import { addDays, today } from "@/lib/format";
import { calendarDays, formatTime, type CalEntry } from "@/lib/events";
import { PaintChip, SectionHead } from "@/components/ui";

// On both home screens: the week ahead from the calendar, events and dated
// jobs together. Bins have their own notice, so they're left to the calendar.

const SHOWN = 6;

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" });

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

  if (total === 0) {
    return (
      <button
        type="button"
        onClick={() => open()}
        className="flex w-full items-center gap-3 rounded-card border border-dashed border-line-strong px-4 py-3.5 text-left transition-colors hover:border-tick-ring"
      >
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-sunken text-ink-2">
          <CalendarDays size={20} />
        </span>
        <span className="grid min-w-0">
          <span className="text-supporting font-semibold text-ink">Nothing on this week</span>
          <span className="text-meta text-ink-2">Birthdays, gigs and family dos go on the calendar, with your job dates.</span>
        </span>
      </button>
    );
  }

  // Whole days, until the next would go past what fits.
  const shown: typeof days = [];
  let count = 0;
  for (const day of days) {
    if (shown.length && count + day[1].length > SHOWN) break;
    shown.push(day);
    count += day[1].length;
  }
  const hidden = total - count;

  return (
    <section aria-labelledby="coming-head">
      <SectionHead id="coming-head" title="Coming up">
        <button
          type="button"
          onClick={() => open()}
          className="inline-flex items-center gap-0.5 text-supporting font-semibold text-accent-text hover:underline"
        >
          Calendar <ChevronRight size={16} />
        </button>
      </SectionHead>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
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
      {hidden > 0 && (
        <button type="button" onClick={() => open()} className="mt-2 px-1 text-meta font-semibold text-ink-2 hover:text-ink">
          {hidden} more this week
        </button>
      )}
    </section>
  );
}
