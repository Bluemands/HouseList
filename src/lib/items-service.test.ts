import { describe, expect, it, vi } from "vitest";
import { nextActualPrice, nextRound, nextSteps } from "@/lib/items-service";
import type { Item, Step } from "@/generated/prisma/client";

const step = (id: string, done = false, cost: number | null = null) => ({
  id,
  text: `Step ${id}`,
  done,
  cost,
  link: null,
  notes: null,
});

describe("nextSteps", () => {
  const current = [step("a", true, 200), step("b")];

  it("leaves steps alone when nothing about them changes", () => {
    expect(nextSteps(current, {})).toBeUndefined();
  });

  it("takes a full list as given", () => {
    expect(nextSteps(current, { steps: [{ text: "Only this" }] })).toEqual([{ text: "Only this" }]);
  });

  it("ticks one step against the steps as they are now", () => {
    expect(nextSteps(current, { stepDone: { id: "b", done: true } })!.map((s) => s.done)).toEqual([true, true]);
  });

  it("appends after the current steps, keeping their ids and ticks", () => {
    const out = nextSteps(current, { appendSteps: [{ text: "Grout", cost: 15 }] })!;
    expect(out.map((s) => [s.id, s.done, s.text])).toEqual([
      ["a", true, "Step a"],
      ["b", false, "Step b"],
      [undefined, undefined, "Grout"],
    ]);
  });
});

describe("nextActualPrice", () => {
  const open = { status: "TODO" as const, actualPrice: null, estimatedPrice: 120 };

  it("assumes the estimate when something is finished without a price", () => {
    expect(nextActualPrice(open, { status: "DONE" })).toBe(120);
    expect(nextActualPrice(open, { status: "DONE", estimatedPrice: 90 })).toBe(90);
    expect(nextActualPrice(open, { status: "DONE", actualPrice: 100 })).toBe(100);
  });

  it("forgets the assumed price on reopening, unless one is given", () => {
    const done = { status: "DONE" as const, actualPrice: 120, estimatedPrice: 120 };
    expect(nextActualPrice(done, { status: "TODO" })).toBeNull();
    expect(nextActualPrice(done, { status: "TODO", actualPrice: 80 })).toBe(80);
  });

  it("keeps the price through other edits", () => {
    expect(nextActualPrice({ ...open, actualPrice: 50 }, { estimatedPrice: 70 })).toBe(50);
  });
});

describe("nextRound", () => {
  it("schedules a fresh copy from the day it was done", () => {
    const done = {
      id: "boiler",
      title: "Boiler service",
      kind: "TASK",
      room: "WHOLE_HOUSE",
      priority: "MUST_HAVE",
      status: "DONE",
      estimatedPrice: 90,
      estimateMax: null,
      assignee: "Both",
      project: null,
      links: [],
      notes: null,
      repeat: "YEARLY",
      addedBy: "Sam",
      steps: [{ ...step("s1", true, 20), position: 0 } as Step],
    } as unknown as Item & { steps: Step[] };
    const next = nextRound(done, "2026-10-11");
    expect(next).toMatchObject({ title: "Boiler service", spawnedFromId: "boiler", repeat: "YEARLY" });
    expect(next.dueDate?.toISOString().slice(0, 10)).toBe("2027-10-11");
    expect(next.steps?.create).toEqual([{ text: "Step s1", done: false, position: 0, cost: 20, link: null, notes: null }]);
  });

  it("counts from the day it was done in the UK, not on the server's clock", () => {
    // Ticked off at 00:30 on Tuesday 13 October, British Summer Time: still
    // Monday on a UTC server.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T23:30:00Z"));
    try {
      const bins = { id: "bins", title: "Bins", repeat: "WEEKLY", steps: [] } as unknown as Item & { steps: Step[] };
      expect(nextRound(bins).dueDate?.toISOString().slice(0, 10)).toBe("2026-10-20");
    } finally {
      vi.useRealTimers();
    }
  });
});
