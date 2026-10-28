import { describe, expect, it } from "vitest";
import { addMonth, calendarDays, eventsOn, formatTime, monthGrid, nthOccurrence, occurrences, type EventDTO } from "./events";
import type { Bin } from "./bins";
import type { ItemDTO } from "./types";

const event = (over: Partial<EventDTO> = {}): EventDTO => ({
  id: "e",
  title: "Gig",
  date: "2026-11-08",
  endDate: null,
  time: null,
  repeat: null,
  notes: null,
  addedBy: "Connor",
  createdAt: "2026-10-28T10:00:00.000Z",
  ...over,
});

const item = (over: Partial<ItemDTO>) => ({ id: "i", title: "Job", status: "TODO", dueDate: null, ...over }) as ItemDTO;

describe("occurrences", () => {
  it("finds a one-off only when it's in the window", () => {
    expect(occurrences(event(), "2026-11-01", "2026-11-30")).toEqual([{ start: "2026-11-08", end: "2026-11-08" }]);
    expect(occurrences(event(), "2026-12-01", "2026-12-31")).toEqual([]);
  });

  it("catches something that started before the window and is still on", () => {
    const trip = event({ date: "2026-10-30", endDate: "2026-11-02" });
    expect(occurrences(trip, "2026-11-01", "2026-11-30")).toEqual([{ start: "2026-10-30", end: "2026-11-02" }]);
  });

  it("brings a birthday round every year, never before the first", () => {
    const birthday = event({ date: "1990-03-14", repeat: "YEARLY" });
    expect(occurrences(birthday, "2027-01-01", "2027-12-31").map((o) => o.start)).toEqual(["2027-03-14"]);
    expect(occurrences(event({ date: "2027-03-14", repeat: "YEARLY" }), "2026-01-01", "2026-12-31")).toEqual([]);
  });

  it("keeps a leap-day birthday on 28 February in other years", () => {
    expect(nthOccurrence("2000-02-29", "YEARLY", 27)).toBe("2027-02-28");
    expect(nthOccurrence("2000-02-29", "YEARLY", 28)).toBe("2028-02-29");
  });

  it("puts a monthly thing back on the 31st after a short month", () => {
    const rent = event({ date: "2026-01-31", repeat: "MONTHLY" });
    expect(occurrences(rent, "2026-02-01", "2026-03-31").map((o) => o.start)).toEqual(["2026-02-28", "2026-03-31"]);
  });

  it("goes weekly", () => {
    const club = event({ date: "2026-10-06", repeat: "WEEKLY" });
    expect(occurrences(club, "2026-11-01", "2026-11-15").map((o) => o.start)).toEqual(["2026-11-03", "2026-11-10"]);
  });
});

describe("calendarDays", () => {
  const bin: Bin = { id: "b", name: "Recycling", colour: "#2f6db5", everyWeeks: 2, from: "2026-11-03", changes: [] };

  it("lays out events, dated jobs and bins by day", () => {
    const days = calendarDays(
      {
        events: [
          event({ id: "late", title: "Gig", date: "2026-11-03", time: "19:30" }),
          event({ id: "early", title: "Lunch", date: "2026-11-03", time: "12:00" }),
          event({ id: "allday", title: "Mum's birthday", date: "2026-11-03" }),
        ],
        items: [
          item({ id: "due", dueDate: "2026-11-03" }),
          item({ id: "done", dueDate: "2026-11-03", status: "DONE" }),
          item({ id: "undated" }),
        ],
        bins: [bin],
      },
      "2026-11-01",
      "2026-11-07",
    );
    expect([...days.keys()]).toEqual(["2026-11-03"]);
    expect(
      days.get("2026-11-03")!.map((e) => (e.kind === "event" ? e.event.id : e.kind === "item" ? e.item.id : "bins")),
    ).toEqual(["allday", "early", "late", "due", "bins"]);
  });

  it("shows a several-day event on each of its days", () => {
    const days = calendarDays({ events: [event({ date: "2026-11-06", endDate: "2026-11-08" })], items: [], bins: [] }, "2026-11-07", "2026-11-30");
    expect([...days.keys()]).toEqual(["2026-11-07", "2026-11-08"]);
  });
});

describe("eventsOn", () => {
  it("finds what's on a day, all-day things first", () => {
    const list = [event({ id: "a", time: "18:00" }), event({ id: "b" }), event({ id: "c", date: "2026-11-09" })];
    expect(eventsOn(list, "2026-11-08").map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("formatTime", () => {
  it("reads like a person says it", () => {
    expect(formatTime("19:30")).toBe("7:30pm");
    expect(formatTime("20:00")).toBe("8pm");
    expect(formatTime("00:15")).toBe("12:15am");
    expect(formatTime("12:00")).toBe("12pm");
  });
});

describe("monthGrid", () => {
  it("fills whole Monday-first weeks", () => {
    const weeks = monthGrid("2026-11");
    expect(weeks[0][0]).toBe("2026-10-26");
    expect(weeks.at(-1)!.at(-1)).toBe("2026-12-06");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("steps months across the year", () => {
    expect(addMonth("2026-12", 1)).toBe("2027-01");
    expect(addMonth("2026-01", -1)).toBe("2025-12");
  });
});
