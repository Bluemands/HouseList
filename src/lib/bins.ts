import { addDays, dayDiff } from "@/lib/format";

// Bin day: each bin goes out every so many weeks, counted from any day it's
// been (or will be) collected. A single collection can be moved (a bank
// holiday pushes it a day) or dropped, without touching the pattern.

export type BinChange = {
  /** The collection as it was due. */
  on: string;
  /** When it's collected instead; null when it isn't this time. */
  to: string | null;
};

export type Bin = {
  id: string;
  name: string;
  colour: string;
  everyWeeks: number;
  /** Any day it's collected on, which sets the pattern. */
  from: string;
  changes: BinChange[];
};

export const BINS_MAX = 8;

/** The colours councils use, near enough. */
export const BIN_COLOURS = [
  { name: "Black", hex: "#2f3133" },
  { name: "Grey", hex: "#8b9196" },
  { name: "Blue", hex: "#2f6db5" },
  { name: "Green", hex: "#3d8a4b" },
  { name: "Brown", hex: "#7b5434" },
  { name: "Purple", hex: "#6c4fa2" },
  { name: "Red", hex: "#b8443b" },
] as const;

export type Collection = {
  date: string;
  /** The day it was due, when it's been moved. */
  movedFrom: string | null;
};

/** When a bin is collected between `from` and `until` (inclusive), moves and all. */
export function collections(bin: Bin, from: string, until: string): Collection[] {
  const step = bin.everyWeeks * 7;
  // A moved collection can land a little either side of where it was due, so look a fortnight wider.
  const start = addDays(from, -14);
  const offset = ((dayDiff(bin.from, start) % step) + step) % step;
  let due = offset === 0 ? start : addDays(start, step - offset);
  const out: Collection[] = [];
  const end = addDays(until, 14);
  while (due <= end) {
    const change = bin.changes.find((c) => c.on === due);
    const date = change ? change.to : due;
    if (date && date >= from && date <= until) out.push({ date, movedFrom: change ? due : null });
    due = addDays(due, step);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** The next time a bin goes out, from `day` on. */
export function nextCollection(bin: Bin, day: string): Collection | null {
  return collections(bin, day, addDays(day, bin.everyWeeks * 7 + 14))[0] ?? null;
}

/** The bins that go out on `day`. */
export function binsOn(bins: Bin[], day: string): Bin[] {
  return bins.filter((b) => collections(b, day, day).length > 0);
}

/** Changes to collections long gone are only clutter. */
export function pruneChanges(changes: BinChange[], day: string): BinChange[] {
  const cutoff = addDays(day, -7);
  return changes.filter((c) => c.on >= cutoff || (c.to != null && c.to >= cutoff));
}

/** "Recycling", "Recycling and Garden", "Black, Recycling and Garden". */
export function binNames(bins: Pick<Bin, "name">[]) {
  const names = bins.map((b) => b.name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
}
