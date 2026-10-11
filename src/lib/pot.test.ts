import { describe, expect, it } from "vitest";
import { costToConfirm, settlePot } from "@/lib/pot";

describe("costToConfirm", () => {
  const item = (estimatedPrice: number | null, estimateMax: number | null, actualPrice: number | null = null) => ({
    estimatedPrice,
    estimateMax,
    actualPrice,
  });

  it("asks about a range, or a top with no bottom", () => {
    expect(costToConfirm(item(100, 150))).toEqual({ min: 100, max: 150 });
    expect(costToConfirm(item(null, 150))).toEqual({ min: null, max: 150 });
  });

  it("doesn't ask about a single figure, no figure, or a price already known", () => {
    expect(costToConfirm(item(100, null))).toBeNull();
    expect(costToConfirm(item(100, 100))).toBeNull();
    expect(costToConfirm(item(null, null))).toBeNull();
    expect(costToConfirm(item(100, 150, 120))).toBeNull();
  });
});

const step = (id: string, cost: number | null, done = false, potCharge: number | null = null) => ({
  id,
  cost,
  done,
  potCharge,
});

describe("settlePot", () => {
  it("spends a stage when its step is ticked, and refunds it when unticked", () => {
    const before = { status: "TODO" as const, potCharge: null, steps: [step("a", 200), step("b", 800)] };
    const tick = settlePot(before, { status: "TODO", actualPrice: null, steps: [{ id: "a", done: true, cost: 200 }, { id: "b", cost: 800 }] }, true);
    expect(tick).toMatchObject({ delta: -200, stepCharges: [200, null], itemCharge: null });

    const paid = { ...before, steps: [step("a", 200, true, 200), step("b", 800)] };
    const untick = settlePot(paid, { status: "TODO", actualPrice: null, steps: [{ id: "a", cost: 200 }, { id: "b", cost: 800 }] }, true);
    expect(untick.delta).toBe(200);
  });

  it("finishing the item spends only what the stages haven't", () => {
    const before = { status: "TODO" as const, potCharge: null, steps: [step("a", 200, true, 200), step("b", 800)] };
    const done = settlePot(before, { status: "DONE", actualPrice: 1000 }, true);
    expect(done).toMatchObject({ itemCharge: 800, delta: -800 });
  });

  it("charges a price added after ticking something off", () => {
    const ticked = settlePot({ status: "TODO", potCharge: null, steps: [] }, { status: "DONE", actualPrice: null }, true);
    expect(ticked).toMatchObject({ itemCharge: 0, delta: 0 });
    const priced = settlePot({ status: "DONE", potCharge: 0, steps: [] }, { status: "DONE", actualPrice: 60 }, true);
    expect(priced.delta).toBe(-60);
  });

  it("takes the rest when a range turns out dearer than its bottom figure", () => {
    // Finished at the £100 guess; it came to £130.
    const done = { status: "DONE" as const, potCharge: 100, steps: [] };
    expect(settlePot(done, { status: "DONE", actualPrice: 130 }, true)).toMatchObject({ itemCharge: 130, delta: -30 });
    expect(settlePot(done, { status: "DONE", actualPrice: 90 }, true)).toMatchObject({ itemCharge: 90, delta: 10 });
  });

  it("never touches the pot for things ticked before it was in use", () => {
    const before = { status: "TODO" as const, potCharge: null, steps: [step("a", 200)] };
    const off = settlePot(before, { status: "DONE", actualPrice: 500, steps: [{ id: "a", done: true, cost: 200 }] }, false);
    expect(off).toMatchObject({ itemCharge: null, stepCharges: [null], delta: 0 });
    // Reopened after the pot was set up: still nothing to give back.
    const reopen = settlePot({ status: "DONE", potCharge: null, steps: [step("a", 200, true)] }, { status: "TODO", actualPrice: 500 }, true);
    expect(reopen.delta).toBe(0);
  });

  it("doesn't refund a paid step that's deleted", () => {
    const before = { status: "TODO" as const, potCharge: null, steps: [step("a", 200, true, 200), step("b", 50)] };
    const r = settlePot(before, { status: "TODO", actualPrice: null, steps: [{ id: "b", cost: 50 }] }, true);
    expect(r.delta).toBe(0);
  });
});
