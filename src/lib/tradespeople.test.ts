import { describe, expect, it } from "vitest";
import { telHref, unsavedQuoters, workFor } from "@/lib/tradespeople";
import type { ItemDTO } from "@/lib/types";

const quote = (from: string, amount: number, createdAt: string, chosen = false) => ({
  id: `${from}-${amount}`,
  from,
  amount,
  note: null,
  chosen,
  addedBy: "Connor",
  createdAt,
});

const item = (id: string, over: Partial<ItemDTO> = {}) =>
  ({ id, title: id, room: "KITCHEN", status: "TODO", assignee: null, quotes: [], createdAt: "2026-10-01T00:00:00Z", ...over }) as ItemDTO;

const items = [
  item("Rewire", { quotes: [quote("Sparks Ltd", 3000, "2026-10-02T00:00:00Z"), quote("Bob", 2800, "2026-10-03T00:00:00Z", true)] }),
  item("Boiler", { quotes: [quote("  sparks   ltd ", 120, "2026-10-05T00:00:00Z")] }),
  item("Fence", { assignee: "Bob" }),
];

describe("workFor", () => {
  it("finds their quotes and jobs by name, however it was typed", () => {
    expect(workFor("Sparks Ltd", items).map((w) => [w.item.id, w.quote?.amount])).toEqual([
      ["Boiler", 120],
      ["Rewire", 3000],
    ]);
    expect(workFor("bob", items).map((w) => [w.item.id, w.quote?.chosen ?? null])).toEqual([
      ["Rewire", true],
      ["Fence", null],
    ]);
  });
});

describe("unsavedQuoters", () => {
  it("lists who's quoted but isn't in the book, most quotes first", () => {
    expect(unsavedQuoters(items, []).map((q) => [q.name, q.count])).toEqual([
      ["Sparks Ltd", 2],
      ["Bob", 1],
    ]);
    expect(unsavedQuoters(items, [{ name: "SPARKS LTD" }]).map((q) => q.name)).toEqual(["Bob"]);
  });
});

describe("telHref", () => {
  it("keeps only what a phone dials", () => {
    expect(telHref("07700 900-123")).toBe("tel:07700900123");
    expect(telHref("+44 7700 900123")).toBe("tel:+447700900123");
  });
});
