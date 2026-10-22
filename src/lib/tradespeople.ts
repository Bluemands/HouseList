import type { ItemDTO } from "@/lib/types";

// The tradespeople book. A person's quotes and jobs aren't linked by id:
// they're found by name, from who a quote is from and who a job is with, so
// everything already on the list counts from the moment they're saved.

export const VERDICTS = ["YES", "NOT_SURE", "NO"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABELS: Record<Verdict, string> = {
  YES: "Would use again",
  NOT_SURE: "Not sure",
  NO: "Wouldn’t use again",
};

export type TradespersonDTO = {
  id: string;
  name: string;
  trade: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  verdict: Verdict | null;
  addedBy: string;
  createdAt: string;
};

/** Trades offered in a tap. */
export const TRADES = [
  "Electrician",
  "Plumber",
  "Gas engineer",
  "Builder",
  "Plasterer",
  "Joiner",
  "Roofer",
  "Decorator",
  "Tiler",
  "Gardener",
  "Handyman",
] as const;

const key = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export const sameName = (a: string, b: string) => key(a) === key(b);

export type Work = {
  item: ItemDTO;
  /** Their quote for it, if they gave one. */
  quote: ItemDTO["quotes"][number] | null;
};

/** What someone has quoted for or is down to do, newest first. */
export function workFor(name: string, items: ItemDTO[]): Work[] {
  const out: Work[] = [];
  for (const item of items) {
    const quote = item.quotes.find((q) => sameName(q.from, name)) ?? null;
    if (quote || (item.assignee && sameName(item.assignee, name))) out.push({ item, quote });
  }
  return out.sort((a, b) => (b.quote?.createdAt ?? b.item.createdAt).localeCompare(a.quote?.createdAt ?? a.item.createdAt));
}

/**
 * People who've quoted but aren't in the book yet, most quotes first, with
 * the room of their latest quote's job as a hint at what they do.
 */
export function unsavedQuoters(items: ItemDTO[], people: Pick<TradespersonDTO, "name">[]) {
  const found = new Map<string, { name: string; count: number; latest: string }>();
  for (const item of items) {
    for (const q of item.quotes) {
      const k = key(q.from);
      if (!k || people.some((p) => key(p.name) === k)) continue;
      const f = found.get(k) ?? { name: q.from.trim(), count: 0, latest: "" };
      f.count += 1;
      if (q.createdAt > f.latest) f.latest = q.createdAt;
      found.set(k, f);
    }
  }
  return [...found.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest));
}

/** A number a phone can dial: spaces and dashes out, a leading + kept. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
