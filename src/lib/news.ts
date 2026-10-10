import type { ItemDTO } from "@/lib/types";
import { formatGBP } from "@/lib/format";

export type NewsEntry = { key: string; item: ItemDTO; label: "Update" | "Quote" | "Done" | "New"; note?: string };

export type News = {
  /** "Sam" or "Sam and Electrician". */
  who: string;
  /** "added 2 things, finished 1 and posted 1 update". */
  sentence: string;
  /** Most telling first: updates and quotes carry words, then finishes, then additions. */
  entries: NewsEntry[];
};

/** What everyone except `me` did after `since` (an ISO timestamp). */
export function whatsNew(items: ItemDTO[], me: string, since: string): News | null {
  // Repeating jobs spawn their next one automatically; that isn't news.
  const added = items.filter((i) => i.addedBy !== me && !i.spawnedFromId && i.createdAt > since);
  const finished = items.filter((i) => i.completedBy && i.completedBy !== me && i.completedAt && i.completedAt > since);
  // Updates and quotes are the news people would otherwise have to text each other.
  const updates = items.flatMap((item) =>
    item.comments.filter((c) => c.author !== me && c.createdAt > since).map((c) => ({ item, by: c.author, c })),
  );
  const quotes = items.flatMap((item) =>
    item.quotes.filter((q) => q.addedBy !== me && q.createdAt > since).map((q) => ({ item, by: q.addedBy, q })),
  );
  if (!added.length && !finished.length && !updates.length && !quotes.length) return null;

  const people = [
    ...new Set([
      ...added.map((i) => i.addedBy),
      ...finished.map((i) => i.completedBy!),
      ...updates.map((u) => u.by),
      ...quotes.map((q) => q.by),
    ]),
  ];
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    added.length ? `added ${count(added.length, "thing", "things")}` : null,
    finished.length ? `finished ${finished.length}` : null,
    updates.length ? `posted ${count(updates.length, "update", "updates")}` : null,
    quotes.length ? `logged ${count(quotes.length, "quote", "quotes")}` : null,
  ].filter((p): p is string => !!p);

  return {
    who: people.length === 1 ? people[0] : `${people.slice(0, -1).join(", ")} and ${people.at(-1)}`,
    sentence: parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0],
    entries: [
      ...updates.map(({ item, c }) => ({ key: `u${c.id}`, item, label: "Update" as const, note: c.text })),
      ...quotes.map(({ item, q }) => ({ key: `q${q.id}`, item, label: "Quote" as const, note: `${q.from}, ${formatGBP(q.amount)}` })),
      ...finished.map((item) => ({ key: `d${item.id}`, item, label: "Done" as const })),
      ...added.map((item) => ({ key: `n${item.id}`, item, label: "New" as const })),
    ],
  };
}
