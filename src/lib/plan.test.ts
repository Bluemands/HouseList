import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildPlan, compareItems, spending, upNext, affordabilityIndex } from "@/lib/plan";
import type { ItemDTO, SettingsDTO } from "@/lib/types";

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 9, 15, 0));
});
afterAll(() => vi.useRealTimers());

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
    project: null,
    repeat: null,
    spawnedFromId: null,
    links: [],
    potCharge: 0,
    notes: null,
    addedBy: "Connor",
    completedAt: null,
    completedBy: null,
    createdAt: `2026-10-0${Math.min(9, seq)}T10:00:00.000Z`,
    updatedAt: "2026-10-09T10:00:00.000Z",
    steps: [],
    pinned: false,
    quotes: [],
    comments: [],
    ...over,
  };
}

const settings = (pot: number, monthly = 0): SettingsDTO => ({
  budgetAvailable: pot,
  potTracked: true,
  monthlySaving: monthly,
  members: ["Connor"],
  movedInOn: null,
  lastPaydayOn: null,
  lastPaydayBy: null,
});

describe("buildPlan", () => {
  it("spends on pinned items first, whatever their priority", () => {
    const reno = item({ title: "Kitchen", priority: "MUST_HAVE", estimatedPrice: 5000 });
    const damp = item({ title: "Damp", priority: "WOULD_LIKE", estimatedPrice: 2300, pinned: true });
    const plan = buildPlan([reno, damp], settings(5000));
    expect(plan.entries.map((e) => [e.item.title, e.monthsAway])).toEqual([
      ["Damp", 0],
      ["Kitchen", null],
    ]);
  });
  it("spends the pot in priority order, then month by month", () => {
    const must = item({ title: "Locks", priority: "MUST_HAVE", estimatedPrice: 200 });
    const want = item({ title: "Rug", estimatedPrice: 300 });
    const later = item({ title: "Shed", priority: "SOMEDAY", estimatedPrice: 1000 });
    const plan = buildPlan([later, want, must], settings(400, 250));
    expect(plan.entries.map((e) => [e.item.title, e.monthsAway])).toEqual([
      ["Locks", 0],
      ["Rug", 1], // 500 cumulative, 100 short → 1 month
      ["Shed", 5], // 1500 cumulative, 1100 short → 5 months
    ]);
    expect(plan.mustTotal).toBe(200);
    expect(plan.mustSpare).toBe(200);
    expect(plan.allClearIn).toBe(5);
    expect(plan.affordableNowCount).toBe(1);
  });

  it("plans ranges at the top figure and ignores free and finished items", () => {
    const range = item({ estimatedPrice: 100, estimateMax: 180 });
    const free = item({});
    const done = item({ status: "DONE", estimatedPrice: 999, actualPrice: 999 });
    const plan = buildPlan([range, free, done], settings(1000));
    expect(plan.entries).toHaveLength(1);
    expect(plan.openTotal).toBe(180);
  });

  it("says never when there's no saving and the pot is short", () => {
    const plan = buildPlan([item({ estimatedPrice: 500 })], settings(100, 0));
    expect(plan.entries[0].monthsAway).toBeNull();
    expect(plan.allClearIn).toBeNull();
  });

  it("puts in-progress work first within a priority", () => {
    const a = item({ title: "A", priority: "MUST_HAVE", estimatedPrice: 10 });
    const b = item({ title: "B", priority: "MUST_HAVE", estimatedPrice: 10, status: "DOING" });
    expect([a, b].sort(compareItems).map((i) => i.title)).toEqual(["B", "A"]);
  });
});

describe("upNext", () => {
  it("leads with overdue work, then soon-due must-haves", () => {
    const overdue = item({ title: "Overdue", dueDate: "2026-10-05" });
    const mustSoon = item({ title: "Must soon", priority: "MUST_HAVE", dueDate: "2026-10-11" });
    const someday = item({ title: "Someday", priority: "SOMEDAY" });
    const plan = buildPlan([overdue, mustSoon, someday], settings(0));
    const next = upNext([someday, mustSoon, overdue], "Connor", affordabilityIndex(plan), 3);
    expect(next.map((i) => i.title)).toEqual(["Overdue", "Must soon", "Someday"]);
  });
  it("doesn't hold back costed must-haves before the pot is set up", () => {
    const must = item({ title: "Paint hallway", priority: "MUST_HAVE", estimatedPrice: 120 });
    const free = item({ title: "Call electrician" });
    const plan = buildPlan([must, free], { ...settings(0), potTracked: false });
    expect(affordabilityIndex(plan).size).toBe(0);
    expect(upNext([free, must], "Connor", affordabilityIndex(plan), 2).map((i) => i.title)).toEqual([
      "Paint hallway",
      "Call electrician",
    ]);
  });
});

describe("spending", () => {
  it("compares actuals against estimates", () => {
    const s = spending([
      item({ status: "DONE", estimatedPrice: 100, actualPrice: 90, completedAt: "2026-10-02T10:00:00Z" }),
      item({ status: "DONE", estimatedPrice: 100, actualPrice: 120, completedAt: "2026-09-02T10:00:00Z" }),
    ]);
    expect(s.spent).toBe(210);
    expect(s.estimateDelta).toBeCloseTo(0.05);
    expect(s.months.at(-1)).toEqual({ key: "2026-10", total: 90 });
  });
});
