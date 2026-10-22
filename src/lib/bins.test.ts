import { describe, expect, it } from "vitest";
import { binNames, binsOn, collections, nextCollection, pruneChanges, type Bin } from "@/lib/bins";

const bin = (over: Partial<Bin> = {}): Bin => ({
  id: "b",
  name: "Recycling",
  colour: "#2f6db5",
  everyWeeks: 2,
  // A Tuesday.
  from: "2026-10-06",
  changes: [],
  ...over,
});

describe("collections", () => {
  it("follows the pattern either side of the day it was set from", () => {
    expect(collections(bin(), "2026-09-20", "2026-11-05").map((c) => c.date)).toEqual([
      "2026-09-22",
      "2026-10-06",
      "2026-10-20",
      "2026-11-03",
    ]);
  });

  it("goes weekly", () => {
    expect(collections(bin({ everyWeeks: 1 }), "2026-10-07", "2026-10-21").map((c) => c.date)).toEqual([
      "2026-10-13",
      "2026-10-20",
    ]);
  });

  it("moves one collection, and drops another", () => {
    const b = bin({
      changes: [
        { on: "2026-10-20", to: "2026-10-21" },
        { on: "2026-11-03", to: null },
      ],
    });
    expect(collections(b, "2026-10-14", "2026-11-20")).toEqual([
      { date: "2026-10-21", movedFrom: "2026-10-20" },
      { date: "2026-11-17", movedFrom: null },
    ]);
  });

  it("catches a collection moved into the range from outside it", () => {
    const b = bin({ changes: [{ on: "2026-10-20", to: "2026-10-17" }] });
    expect(collections(b, "2026-10-17", "2026-10-17")).toEqual([{ date: "2026-10-17", movedFrom: "2026-10-20" }]);
  });
});

describe("nextCollection", () => {
  it("is today on the day", () => {
    expect(nextCollection(bin(), "2026-10-20")?.date).toBe("2026-10-20");
    expect(nextCollection(bin(), "2026-10-21")?.date).toBe("2026-11-03");
  });
});

describe("binsOn", () => {
  it("finds the bins out on a day", () => {
    const black = bin({ id: "k", name: "Black", from: "2026-10-13" });
    const recycling = bin();
    expect(binsOn([black, recycling], "2026-10-20").map((b) => b.id)).toEqual(["b"]);
    expect(binsOn([black, recycling], "2026-10-27").map((b) => b.id)).toEqual(["k"]);
    expect(binsOn([black, recycling], "2026-10-28")).toEqual([]);
  });
});

describe("pruneChanges", () => {
  it("keeps recent and coming changes only", () => {
    const kept = pruneChanges(
      [
        { on: "2026-09-01", to: "2026-09-02" },
        { on: "2026-10-20", to: null },
        { on: "2026-11-03", to: "2026-11-04" },
      ],
      "2026-10-22",
    );
    expect(kept.map((c) => c.on)).toEqual(["2026-10-20", "2026-11-03"]);
  });
});

describe("binNames", () => {
  it("lists them as you'd say them", () => {
    expect(binNames([{ name: "Black" }])).toBe("Black");
    expect(binNames([{ name: "Black" }, { name: "Garden" }])).toBe("Black and Garden");
    expect(binNames([{ name: "Black" }, { name: "Glass" }, { name: "Garden" }])).toBe("Black, Glass and Garden");
  });
});
