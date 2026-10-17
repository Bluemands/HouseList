import { describe, expect, it } from "vitest";
import { whatsNew } from "@/lib/news";
import type { ItemDTO } from "@/lib/types";

const SINCE = "2026-10-09T12:00:00.000Z";
const BEFORE = "2026-10-09T09:00:00.000Z";
const AFTER = "2026-10-09T18:00:00.000Z";

let seq = 0;
function item(over: Partial<ItemDTO>): ItemDTO {
  seq += 1;
  return {
    id: `i${seq}`,
    title: `Item ${seq}`,
    kind: "TASK",
    room: "WHOLE_HOUSE",
    priority: "WOULD_LIKE",
    status: "TODO",
    estimatedPrice: null,
    estimateMax: null,
    isQuote: false,
    actualPrice: null,
    assignee: null,
    dueDate: null,
    warrantyUntil: null,
    project: null,
    repeat: null,
    spawnedFromId: null,
    pinned: false,
    links: [],
    potCharge: 0,
    notes: null,
    addedBy: "Connor",
    completedAt: null,
    completedBy: null,
    createdAt: BEFORE,
    updatedAt: BEFORE,
    steps: [],
    quotes: [],
    comments: [],
    photos: [],
    ...over,
  };
}

describe("whatsNew", () => {
  it("is quiet when only I did things, or nothing changed", () => {
    expect(whatsNew([item({ createdAt: AFTER }), item({})], "Connor", SINCE)).toBeNull();
  });

  it("reports the other person's updates and quotes, with their words", () => {
    const tap = item({
      title: "Fix tap",
      comments: [
        { id: "c1", author: "Sam", text: "Plumber coming Tuesday", createdAt: AFTER },
        { id: "c2", author: "Connor", text: "Great", createdAt: AFTER },
        { id: "c3", author: "Sam", text: "Old news", createdAt: BEFORE },
      ],
      quotes: [{ id: "q1", from: "Pipe Co", amount: 120, note: null, chosen: false, addedBy: "Sam", createdAt: AFTER }],
    });
    const news = whatsNew([tap], "Connor", SINCE)!;
    expect(news.who).toBe("Sam");
    expect(news.sentence).toBe("posted 1 update and logged 1 quote");
    expect(news.entries.map((e) => [e.label, e.note])).toEqual([
      ["Update", "Plumber coming Tuesday"],
      ["Quote", "Pipe Co, £120"],
    ]);
  });

  it("joins several kinds of news into one sentence, ignoring auto-scheduled repeats", () => {
    const news = whatsNew(
      [
        item({ addedBy: "Sam", createdAt: AFTER }),
        item({ addedBy: "Sam", createdAt: AFTER }),
        item({ addedBy: "Sam", createdAt: AFTER, spawnedFromId: "i1" }),
        item({ status: "DONE", completedBy: "Sam", completedAt: AFTER }),
      ],
      "Connor",
      SINCE,
    )!;
    expect(news.sentence).toBe("added 2 things and finished 1");
    expect(news.entries.map((e) => e.label)).toEqual(["Done", "New", "New"]);
  });
});
