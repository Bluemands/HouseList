import { describe, expect, it } from "vitest";
import { intervals, latest, monthlyUsage, oddReading, recentPerDay, type ReadingDTO } from "@/lib/meters";

let seq = 0;
const reading = (takenOn: string, value: number, over: Partial<ReadingDTO> = {}): ReadingDTO => {
  seq += 1;
  return {
    id: `r${seq}`,
    meter: "ELECTRIC",
    value,
    takenOn,
    photoId: null,
    takenBy: "Connor",
    createdAt: `2026-10-22T10:00:${String(seq % 60).padStart(2, "0")}.000Z`,
    ...over,
  };
};

describe("intervals", () => {
  it("works out use a day between readings, in date order", () => {
    const out = intervals([reading("2026-10-11", 1100), reading("2026-10-01", 1000)], "ELECTRIC");
    expect(out).toEqual([{ from: "2026-10-01", to: "2026-10-11", days: 10, used: 100, perDay: 10 }]);
  });

  it("starts afresh after a reading lower than the last, and ignores other meters", () => {
    const out = intervals(
      [
        reading("2026-10-01", 1000),
        reading("2026-10-05", 20),
        reading("2026-10-07", 40),
        reading("2026-10-03", 5, { meter: "GAS" }),
      ],
      "ELECTRIC",
    );
    expect(out.map((i) => [i.from, i.to, i.perDay])).toEqual([["2026-10-05", "2026-10-07", 10]]);
  });
});

describe("monthlyUsage", () => {
  it("spreads a stretch over the months it covers", () => {
    // 20 days at 5 a day: 10 in September, 10 in October.
    const out = monthlyUsage([reading("2026-09-21", 0), reading("2026-10-11", 100)], "ELECTRIC", "2026-10-22", 3);
    expect(out).toEqual([
      { key: "2026-08", perDay: null },
      { key: "2026-09", perDay: 5 },
      { key: "2026-10", perDay: 5 },
    ]);
  });

  it("averages two rates within one month by days", () => {
    const out = monthlyUsage(
      [reading("2026-10-01", 0), reading("2026-10-11", 100), reading("2026-10-21", 300)],
      "ELECTRIC",
      "2026-10-22",
      1,
    );
    expect(out[0].perDay).toBeCloseTo(15);
  });
});

describe("latest and recentPerDay", () => {
  it("use the newest readings", () => {
    const list = [reading("2026-10-01", 0), reading("2026-10-11", 100), reading("2026-10-21", 300)];
    expect(latest(list, "ELECTRIC")?.value).toBe(300);
    expect(latest(list, "GAS")).toBeNull();
    expect(recentPerDay(list, "ELECTRIC")).toBe(20);
  });
});

describe("oddReading", () => {
  const last = reading("2026-10-01", 1000);
  it("flags a reading lower than the last", () => {
    expect(oddReading(last, 990, "2026-10-11", 10)).toBe("lower");
  });
  it("flags a leap far beyond the usual", () => {
    expect(oddReading(last, 10000, "2026-10-11", 10)).toBe("high");
    expect(oddReading(last, 1120, "2026-10-11", 10)).toBeNull();
  });
  it("says nothing without a last reading", () => {
    expect(oddReading(null, 5, "2026-10-11", null)).toBeNull();
  });
});
