import { addDays, dayDiff } from "@/lib/format";
import { collections, type Bin } from "@/lib/bins";
import type { ItemDTO, Repeat } from "@/lib/types";

// The calendar: your own events (gigs, family dos, birthdays) alongside the
// list's dated jobs and bin days, which are read from where they already
// live rather than copied in.

/** How often an event can come round: birthdays are yearly. */
export const EVENT_REPEATS = ["YEARLY", "MONTHLY", "WEEKLY"] as const satisfies readonly Repeat[];
export type EventRepeat = (typeof EVENT_REPEATS)[number];

export const EVENT_REPEAT_LABELS: Record<EventRepeat, string> = {
  YEARLY: "Every year",
  MONTHLY: "Every month",
  WEEKLY: "Every week",
};

export const EVENT_TITLE_MAX = 120;

export type EventDTO = {
  id: string;
  title: string;
  date: string;
  /** The last day, for something that runs over several. */
  endDate: string | null;
  /** "19:30", or null for all day. */
  time: string | null;
  repeat: EventRepeat | null;
  notes: string | null;
  addedBy: string;
  createdAt: string;
};

/** The same day n months on, kept in the month (31 Jan + 1 is 28 Feb, and 31 Jan + 2 is 31 Mar again). */
function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}

/** The nth time an event comes round, counted from its first (n = 0). */
export function nthOccurrence(start: string, repeat: EventRepeat, n: number): string {
  if (repeat === "WEEKLY") return addDays(start, 7 * n);
  return addMonths(start, (repeat === "YEARLY" ? 12 : 1) * n);
}

export type Occurrence = { start: string; end: string };

/** Each time an event is on that overlaps `from`–`until` (inclusive), first to last. */
export function occurrences(event: Pick<EventDTO, "date" | "endDate" | "repeat">, from: string, until: string): Occurrence[] {
  const span = event.endDate && event.endDate > event.date ? dayDiff(event.date, event.endDate) : 0;
  const at = (start: string) => ({ start, end: addDays(start, span) });
  if (!event.repeat) {
    const once = at(event.date);
    return once.end >= from && once.start <= until ? [once] : [];
  }
  // Start a little before the window: one that began earlier may still be running.
  const stepDays = event.repeat === "WEEKLY" ? 7 : event.repeat === "MONTHLY" ? 28 : 365;
  const roughly = Math.floor(dayDiff(event.date, from) / stepDays);
  let n = Math.max(0, roughly - 1 - Math.ceil(span / stepDays));
  const out: Occurrence[] = [];
  for (let guard = 0; guard < 1000; guard++, n++) {
    const o = at(nthOccurrence(event.date, event.repeat, n));
    if (o.start > until) break;
    if (o.end >= from) out.push(o);
  }
  return out;
}

export type CalEntry =
  | { kind: "event"; event: EventDTO; start: string; end: string }
  | { kind: "item"; item: ItemDTO }
  | { kind: "bins"; bins: Bin[] };

/** Every day from `from` to `until` with something on, and what. All-day events lead, then by time, then jobs, then bins. */
export function calendarDays(
  { events, items, bins }: { events: EventDTO[]; items: ItemDTO[]; bins: Bin[] },
  from: string,
  until: string,
): Map<string, CalEntry[]> {
  const days = new Map<string, CalEntry[]>();
  const put = (day: string, entry: CalEntry) => {
    if (day < from || day > until) return;
    const list = days.get(day);
    if (list) list.push(entry);
    else days.set(day, [entry]);
  };

  const timed = [...events].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
  for (const event of timed) {
    for (const o of occurrences(event, from, until)) {
      for (let day = o.start; day <= o.end; day = addDays(day, 1)) put(day, { kind: "event", event, start: o.start, end: o.end });
    }
  }
  for (const item of items) {
    if (item.dueDate && item.status !== "DONE") put(item.dueDate, { kind: "item", item });
  }
  const byDay = new Map<string, Bin[]>();
  for (const bin of bins) {
    for (const c of collections(bin, from, until)) byDay.set(c.date, [...(byDay.get(c.date) ?? []), bin]);
  }
  for (const [day, out] of byDay) put(day, { kind: "bins", bins: out });

  return new Map([...days].sort(([a], [b]) => a.localeCompare(b)));
}

/** The events on one day, for the morning reminder. */
export function eventsOn(events: EventDTO[], day: string): EventDTO[] {
  return events
    .filter((e) => occurrences(e, day, day).length > 0)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
}

/** "19:30" as the UK says it: "7:30pm", "8pm". */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 || 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/** The weeks of a month as Monday-first rows of days, padded with the days either side. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks = Math.ceil((lead + last) / 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d - lead)));
}

/** "2026-11" moved by n months. */
export function addMonth(month: string, n: number): string {
  return addMonths(`${month}-01`, n).slice(0, 7);
}
