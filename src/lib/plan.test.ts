import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  affordabilityIndex,
  buildPlan,
  compareItems,
  describeMoves,
  describeWhen,
  planCost,
  planImpact,
  planShifts,
  spending,
  upNext,
} from "@/lib/plan";
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
    warrantyUntil: null,
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
  workerSeenAt: null,
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

describe("planImpact", () => {
  it("says where an item sits, and how short or spare the pot is there", () => {
    const locks = item({ title: "Locks", priority: "MUST_HAVE", estimatedPrice: 200 });
    const rug = item({ title: "Rug", estimatedPrice: 300 });
    const impact = planImpact([locks, rug], settings(400, 100), rug);
    expect(impact.before).toEqual({ monthsAway: 1, short: 100, spare: 0, ahead: 1 });
    expect(impact.after).toEqual(impact.before);
    expect(planImpact([locks, rug], settings(400, 100), locks).after).toEqual({
      monthsAway: 0,
      short: 0,
      spare: 200,
      ahead: 0,
    });
  });

  it("names what a change of priority pushes back", () => {
    const locks = item({ title: "Locks", priority: "MUST_HAVE", estimatedPrice: 300 });
    const sofa = item({ title: "Sofa", estimatedPrice: 600 });
    const shed = item({ title: "Shed", priority: "SOMEDAY", estimatedPrice: 400 });
    const all = [locks, sofa, shed];
    const impact = planImpact(all, settings(500, 200), { ...shed, priority: "MUST_HAVE" });
    expect(impact.before?.monthsAway).toBe(4);
    expect(impact.after?.monthsAway).toBe(1);
    expect(impact.later.map((m) => [m.item.title, m.from, m.to])).toEqual([["Sofa", 2, 4]]);
    expect(impact.sooner).toEqual([]);
  });

  it("names what dropping something brings forward", () => {
    const sofa = item({ title: "Sofa", estimatedPrice: 600 });
    const rug = item({ title: "Rug", estimatedPrice: 200 });
    const impact = planImpact([sofa, rug], settings(300, 0), { ...sofa, priority: "SOMEDAY" });
    expect(impact.after?.monthsAway).toBeNull();
    expect(impact.sooner.map((m) => [m.item.title, m.from, m.to])).toEqual([["Rug", null, 0]]);
  });

  it("previews pinning, a new item, and an item that's been made free", () => {
    const boiler = item({ title: "Boiler", priority: "MUST_HAVE", estimatedPrice: 900 });
    const blind = item({ title: "Blind", estimatedPrice: 80 });
    const all = [boiler, blind];
    expect(planImpact(all, settings(1000), { ...blind, pinned: true }).later).toEqual([]);
    const pinned = planImpact(all, settings(950), { ...blind, pinned: true });
    expect(pinned.after?.monthsAway).toBe(0);
    expect(pinned.later.map((m) => [m.item.title, m.from, m.to])).toEqual([["Boiler", 0, null]]);

    // A new must-have queues behind the older one, ahead of the would-likes.
    const fresh = item({ id: "new", title: "Fence", priority: "MUST_HAVE", estimatedPrice: 500 });
    const added = planImpact(all, settings(1000), fresh);
    expect(added.before).toBeNull();
    expect(added.after?.monthsAway).toBeNull();
    expect(added.later.map((m) => m.item.title)).toEqual(["Blind"]);

    expect(planImpact(all, settings(0), { ...boiler, estimatedPrice: null }).after).toBeNull();
  });
});

describe("planShifts", () => {
  it("moves the rest of the plan when several things change at once", () => {
    const sofa = item({ title: "Sofa", estimatedPrice: 600 });
    const rug = item({ title: "Rug", estimatedPrice: 200 });
    const lamp = item({ title: "Lamp", estimatedPrice: 50 });
    const shed = item({ title: "Shed", priority: "SOMEDAY", estimatedPrice: 100 });
    const all = [sofa, rug, lamp, shed];
    const { later, sooner } = planShifts(all, settings(300, 100), [sofa, rug].map((i) => ({ ...i, priority: "SOMEDAY" as const })));
    // Sofa and Rug were the ones changed, so only the others are reported.
    expect(sooner.map((m) => [m.item.title, m.from, m.to])).toEqual([
      ["Lamp", 6, 0],
      ["Shed", 7, 0],
    ]);
    expect(later).toEqual([]);
  });

  it("names what moved, briefly", () => {
    const long = item({ title: "Install fire alarms, 1 office, 1 master bedroom, 1 hallway" });
    const rug = item({ title: "Rug" });
    expect(describeMoves([{ item: rug, from: 2, to: 0 }])).toBe("“Rug” (to now)");
    expect(describeMoves([{ item: long, from: 0, to: 2 }, { item: rug, from: 0, to: null }])).toBe(
      "“Install fire alarms, 1 office, 1 maste…” (to Dec 2026) and 1 more",
    );
    expect(describeWhen(null)).toBe("not at current savings");
    expect(describeWhen(3, true)).toBe("January 2027");
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

describe("stage payments", () => {
  const stage = (text: string, cost: number, done: boolean, doneAt: string | null = null) => ({
    id: text,
    text,
    done,
    cost,
    link: null,
    notes: null,
    potCharge: done ? cost : null,
    doneAt,
  });

  it("plans only what's still to pay on a job", () => {
    const reno = item({
      estimatedPrice: 1000,
      steps: [stage("Deposit", 200, true), stage("Balance", 800, false)],
    });
    expect(planCost(reno)).toBe(800);
  });

  it("never plans below the estimate when an old range top is left behind", () => {
    // A £200–300 job, then told it's £1,000 without the range being cleared
    // (as the connector can): the app shows £1,000, so the plan counts £1,000.
    expect(planCost(item({ estimatedPrice: 1000, estimateMax: 300 }))).toBe(1000);
    expect(planCost(item({ estimatedPrice: 200, estimateMax: 300 }))).toBe(300);
    expect(planCost(item({ estimateMax: 300 }))).toBe(300);
  });

  it("counts stages as spent when they're ticked, and the rest when the job is done", () => {
    const going = item({
      estimatedPrice: 1000,
      steps: [stage("Deposit", 200, true, "2026-10-02T10:00:00.000Z"), stage("Balance", 800, false)],
    });
    const finished = item({
      status: "DONE",
      estimatedPrice: 300,
      actualPrice: 300,
      completedAt: "2026-10-05T10:00:00.000Z",
      steps: [stage("Tiles", 100, true, "2026-09-20T10:00:00.000Z"), stage("Fitting", 200, true, "2026-10-05T10:00:00.000Z")],
    });
    const s = spending([going, finished]);
    expect(s.spent).toBe(500);
    expect(s.stagesPaid).toBe(200);
    expect(s.months.at(-2)).toEqual({ key: "2026-09", total: 100 });
    expect(s.months.at(-1)).toEqual({ key: "2026-10", total: 400 });
  });
});
