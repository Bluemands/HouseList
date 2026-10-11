import { describe, expect, it } from "vitest";
import { nextOccurrence, rebaseSteps, stepsGap } from "@/lib/types";

describe("stepsGap", () => {
  const quoted = { estimatedPrice: 2000, estimateMax: null, steps: [] };
  it("is what costed steps leave out of the figure the item had", () => {
    expect(stepsGap(quoted, 500)).toBe(1500);
    expect(stepsGap({ estimatedPrice: 300, estimateMax: 450, steps: [{ cost: null }] }, 100)).toBe(350);
    expect(stepsGap(quoted, 2150.5)).toBe(-150.5);
  });
  it("is null with nothing to compare, or once the steps set the figure", () => {
    expect(stepsGap(quoted, 2000)).toBeNull();
    expect(stepsGap(quoted, null)).toBeNull();
    expect(stepsGap({ estimatedPrice: null, estimateMax: null, steps: [] }, 500)).toBeNull();
    // Already the total of its steps: changing a step's cost is just a new total.
    expect(stepsGap({ estimatedPrice: 500, estimateMax: null, steps: [{ cost: 200 }, { cost: 300 }] }, 650)).toBeNull();
  });
});

describe("nextOccurrence", () => {
  it("steps by each interval", () => {
    expect(nextOccurrence("2026-10-09", "WEEKLY")).toBe("2026-10-16");
    expect(nextOccurrence("2026-10-09", "MONTHLY")).toBe("2026-11-09");
    expect(nextOccurrence("2026-10-09", "QUARTERLY")).toBe("2027-01-09");
    expect(nextOccurrence("2026-10-09", "TWICE_YEARLY")).toBe("2027-04-09");
    expect(nextOccurrence("2026-10-09", "YEARLY")).toBe("2027-10-09");
  });
  it("clamps to the end of shorter months", () => {
    expect(nextOccurrence("2027-01-31", "MONTHLY")).toBe("2027-02-28");
    expect(nextOccurrence("2028-01-31", "MONTHLY")).toBe("2028-02-29");
    expect(nextOccurrence("2028-02-29", "YEARLY")).toBe("2029-02-28");
  });
});

describe("rebaseSteps", () => {
  type Sent = { id?: string; text: string; done?: boolean };
  const step = (id: string, done = false) => ({ id, text: `Step ${id}`, done });

  it("keeps a tick made on the other phone while the sheet was open", () => {
    const opened = [step("a"), step("b")];
    const sent: Sent[] = [step("a"), step("b"), { text: "Grout", done: false }];
    const live = [step("a", true), step("b")];
    expect(rebaseSteps(sent, opened, live).map((s) => [s.id, s.done])).toEqual([
      ["a", true],
      ["b", false],
      [undefined, false],
    ]);
  });

  it("still lets this sheet tick or untick a step itself", () => {
    const opened = [step("a", true), step("b")];
    const sent = [step("a", false), step("b", true)];
    expect(rebaseSteps(sent, opened, [step("a", true), step("b")]).map((s) => s.done)).toEqual([false, true]);
  });

  it("keeps steps added elsewhere (Claude's, say) and leaves out ones deleted there", () => {
    const opened = [step("a"), step("b")];
    const sent: Sent[] = [step("a"), step("b"), { text: "Grout" }];
    const live = [step("a"), step("c")];
    expect(rebaseSteps(sent, opened, live).map((s) => s.id ?? s.text)).toEqual(["a", "c", "Grout"]);
  });
});
