import { addDays, dayDiff } from "@/lib/format";

// Meter readings: what each meter said and when. Readings come whenever
// someone remembers, so usage is worked out per day between readings and
// spread over the calendar months those days fall in.

export const METERS = ["GAS", "ELECTRIC", "WATER"] as const;
export type Meter = (typeof METERS)[number];

export const METER_INFO: Record<Meter, { label: string; unit: string }> = {
  GAS: { label: "Gas", unit: "m³" },
  ELECTRIC: { label: "Electric", unit: "kWh" },
  WATER: { label: "Water", unit: "m³" },
};

export type ReadingDTO = {
  id: string;
  meter: Meter;
  value: number;
  takenOn: string;
  photoId: string | null;
  takenBy: string;
  createdAt: string;
};

/** One meter's readings, oldest first (same day: the later entry wins). */
export function readingsOf(readings: ReadingDTO[], meter: Meter): ReadingDTO[] {
  return readings
    .filter((r) => r.meter === meter)
    .sort((a, b) => (a.takenOn === b.takenOn ? a.createdAt.localeCompare(b.createdAt) : a.takenOn.localeCompare(b.takenOn)));
}

export function latest(readings: ReadingDTO[], meter: Meter): ReadingDTO | null {
  return readingsOf(readings, meter).at(-1) ?? null;
}

export type Interval = { from: string; to: string; days: number; used: number; perDay: number };

/**
 * Usage between each reading and the next. A reading lower than the one
 * before (a new meter, or a typo) starts afresh rather than counting as
 * negative use.
 */
export function intervals(readings: ReadingDTO[], meter: Meter): Interval[] {
  const list = readingsOf(readings, meter);
  const out: Interval[] = [];
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1];
    const b = list[i];
    const days = dayDiff(a.takenOn, b.takenOn);
    if (days <= 0 || b.value < a.value) continue;
    const used = b.value - a.value;
    out.push({ from: a.takenOn, to: b.takenOn, days, used, perDay: used / days });
  }
  return out;
}

/** Average use a day over the most recent stretch between readings, or null. */
export function recentPerDay(readings: ReadingDTO[], meter: Meter): number | null {
  return intervals(readings, meter).at(-1)?.perDay ?? null;
}

/**
 * Average use a day in each of the `months` months up to `day`'s, oldest
 * first; null for a month no two readings span.
 */
export function monthlyUsage(readings: ReadingDTO[], meter: Meter, day: string, months = 6) {
  const totals = new Map<string, { used: number; days: number }>();
  for (const iv of intervals(readings, meter)) {
    for (let d = iv.from; d < iv.to; d = addDays(d, 1)) {
      const key = d.slice(0, 7);
      const t = totals.get(key) ?? { used: 0, days: 0 };
      t.used += iv.perDay;
      t.days += 1;
      totals.set(key, t);
    }
  }
  const [y, m] = day.split("-").map(Number);
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1));
    const key = date.toISOString().slice(0, 7);
    const t = totals.get(key);
    return { key, perDay: t && t.days ? t.used / t.days : null };
  });
}

/** Looks wrong next to the last reading: lower than it, or a sudden leap. */
export function oddReading(previous: ReadingDTO | null, value: number, takenOn: string, usualPerDay: number | null) {
  if (!previous || takenOn < previous.takenOn) return null;
  if (value < previous.value) return "lower";
  const days = Math.max(1, dayDiff(previous.takenOn, takenOn));
  if (usualPerDay && usualPerDay > 0 && (value - previous.value) / days > usualPerDay * 5) return "high";
  return null;
}
