// Money owed between the two of you: a bill one paid, half of which is the
// other's. Each payment is open until it's paid; settling up nets everything
// open between two people into one payment from one to the other, and ticks
// the lot off together. None of this touches the pot.

export type PaymentDTO = {
  id: string;
  description: string;
  /** What's owed. */
  amount: number;
  /** The whole bill, when it was split half each. */
  billTotal: number | null;
  owedBy: string;
  owedTo: string;
  billedOn: string;
  /** Null while it's still owed. */
  paidOn: string | null;
  paidBy: string | null;
  /** Shared by every payment cleared in the same settle-up. */
  settlementId: string | null;
  /** The thing on the list this was a share of, when a purchase was split. */
  itemId: string | null;
  addedBy: string;
  createdAt: string;
};

export const DESCRIPTION_MAX = 120;

/** Rounded to the penny, so sums of halves don't drift. */
export const pence = (n: number) => Math.round(n * 100) / 100;

/** Half a bill, to the penny. */
export const half = (total: number) => pence(total / 2);

export type Net = {
  /** Who pays whom to clear it; both null when it comes out even. */
  from: string | null;
  to: string | null;
  amount: number;
};

/** Everything in `payments` (between the same two people) as one payment. */
export function net(payments: Pick<PaymentDTO, "owedBy" | "owedTo" | "amount">[]): Net {
  if (!payments.length) return { from: null, to: null, amount: 0 };
  const a = payments[0].owedBy;
  const b = payments[0].owedTo;
  // Positive: a owes b.
  const total = pence(payments.reduce((sum, p) => sum + (p.owedBy === a ? p.amount : -p.amount), 0));
  if (total === 0) return { from: null, to: null, amount: 0 };
  return total > 0 ? { from: a, to: b, amount: total } : { from: b, to: a, amount: -total };
}

export type Balance = Net & {
  /** The two people, in a fixed order. */
  people: [string, string];
  /** What's still open between them, oldest bill first. */
  open: PaymentDTO[];
};

const pairKey = (p: Pick<PaymentDTO, "owedBy" | "owedTo">) => [p.owedBy, p.owedTo].sort() as [string, string];

/** What's open between each pair of people (with two of you, one). */
export function balances(payments: PaymentDTO[]): Balance[] {
  const pairs = new Map<string, { people: [string, string]; open: PaymentDTO[] }>();
  for (const p of payments) {
    if (p.paidOn) continue;
    const people = pairKey(p);
    const key = people.join("\u0000");
    const pair = pairs.get(key) ?? { people, open: [] };
    pair.open.push(p);
    pairs.set(key, pair);
  }
  return [...pairs.values()].map(({ people, open }) => ({
    ...net(open),
    people,
    open: [...open].sort((x, y) => (x.billedOn === y.billedOn ? x.createdAt.localeCompare(y.createdAt) : x.billedOn.localeCompare(y.billedOn))),
  }));
}

export type HistoryEntry = Net & {
  key: string;
  paidOn: string;
  /** A settle-up (several cleared at once), or one payment ticked off on its own. */
  settlementId: string | null;
  payments: PaymentDTO[];
};

/** What's been paid, newest first: a settle-up as one entry. */
export function history(payments: PaymentDTO[]): HistoryEntry[] {
  const groups = new Map<string, PaymentDTO[]>();
  for (const p of payments) {
    if (!p.paidOn) continue;
    const key = p.settlementId ?? p.id;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const latest = new Map<string, string>();
  const entries: HistoryEntry[] = [...groups.entries()].map(([key, list]) => {
    latest.set(key, list.reduce((t, p) => (p.createdAt > t ? p.createdAt : t), ""));
    // A settle-up's payments share a date; if one was moved since, the latest stands for the lot.
    const paidOn = list.reduce((d, p) => (p.paidOn! > d ? p.paidOn! : d), list[0].paidOn!);
    // What's left of a settle-up after the rest were reopened reads as a payment of its own.
    const single = list.length === 1;
    return {
      key,
      paidOn,
      settlementId: single ? null : list[0].settlementId,
      payments: [...list].sort((x, y) => x.billedOn.localeCompare(y.billedOn)),
      ...(single ? { from: list[0].owedBy, to: list[0].owedTo, amount: list[0].amount } : net(list)),
    };
  });
  return entries.sort((x, y) =>
    x.paidOn === y.paidOn ? latest.get(y.key)!.localeCompare(latest.get(x.key)!) : y.paidOn.localeCompare(x.paidOn),
  );
}

/** How much was cleared in a year, by who owed it to whom (biggest first). */
export function clearedIn(payments: PaymentDTO[], year: string) {
  const totals = new Map<string, { owedBy: string; owedTo: string; amount: number }>();
  for (const p of payments) {
    if (!p.paidOn?.startsWith(year)) continue;
    const key = `${p.owedBy}\u0000${p.owedTo}`;
    const t = totals.get(key) ?? { owedBy: p.owedBy, owedTo: p.owedTo, amount: 0 };
    t.amount = pence(t.amount + p.amount);
    totals.set(key, t);
  }
  return [...totals.values()].sort((a, b) => b.amount - a.amount);
}

export type Recent = Pick<PaymentDTO, "description" | "amount" | "billTotal" | "owedBy" | "owedTo">;

/** The last few different things logged, newest first, to log again in a tap. */
export function recentDescriptions(payments: PaymentDTO[], limit = 5): Recent[] {
  const seen = new Set<string>();
  const out: Recent[] = [];
  for (const p of [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const key = p.description.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ description: p.description, amount: p.amount, billTotal: p.billTotal, owedBy: p.owedBy, owedTo: p.owedTo });
    if (out.length === limit) break;
  }
  return out;
}

/** Shares of a bill offered in a tap, as the percentage the one who owes covers. */
export const SHARE_PRESETS = [30, 40, 60, 70] as const;

/** `pct` percent of a bill, to the penny. */
export const shareOf = (total: number, pct: number) => pence((total * pct) / 100);

/** How a split bill was shared: "half of £170", "40% of £170"; null when it wasn't split. */
export function splitNote(p: Pick<PaymentDTO, "amount" | "billTotal">, format: (n: number) => string) {
  if (p.billTotal == null || p.billTotal <= 0) return null;
  if (p.amount === half(p.billTotal)) return `half of ${format(p.billTotal)}`;
  return `${Math.round((p.amount / p.billTotal) * 100)}% of ${format(p.billTotal)}`;
}

/** "Kerry owes you", "You owe Kerry", "Kerry owes Connor", from where `me` stands. */
export function owesLine(from: string, to: string, me: string) {
  if (from === me) return `You owe ${to}`;
  if (to === me) return `${from} owes you`;
  return `${from} owes ${to}`;
}

/** "Kerry pays you", for what settling up comes to. */
export function paysLine(from: string, to: string, me: string) {
  if (from === me) return `You pay ${to}`;
  if (to === me) return `${from} pays you`;
  return `${from} pays ${to}`;
}

/** The same, once it's paid. */
export function paidLine(from: string, to: string, me: string) {
  if (from === me) return `You paid ${to}`;
  if (to === me) return `${from} paid you`;
  return `${from} paid ${to}`;
}
