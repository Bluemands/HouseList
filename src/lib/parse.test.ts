import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { guessRoom, isShoppingStep, parseQuickAdd, parseStep, pastedLines, sameThing, startsWithJobWord } from "@/lib/parse";

// Friday 9 October 2026, mid-afternoon.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 9, 15, 0));
});
afterAll(() => vi.useRealTimers());

const members = ["Connor", "Sam"];
const p = (s: string) => parseQuickAdd(s, members);

describe("money", () => {
  it("reads a plain price and treats it as a purchase", () => {
    expect(p("Hallway runner £60")).toMatchObject({ title: "Hallway runner", estimatedPrice: 60, kind: "BUY" });
  });
  it("reads ranges in either spelling", () => {
    expect(p("Sofa £800-1200")).toMatchObject({ title: "Sofa", estimatedPrice: 800, estimateMax: 1200 });
    expect(p("Sofa £800 to £1,200")).toMatchObject({ estimatedPrice: 800, estimateMax: 1200 });
    expect(p("Sofa £800–1200")).toMatchObject({ estimatedPrice: 800, estimateMax: 1200 });
  });
  it("reads thousands shorthand and pence", () => {
    expect(p("New boiler £2.5k")).toMatchObject({ estimatedPrice: 2500 });
    expect(p("Bulbs £4.99")).toMatchObject({ estimatedPrice: 4.99 });
    expect(p("Kitchen £8k-12k").estimateMax).toBe(12000);
  });
  it("gives thousands shorthand in whole pounds, not floating-point crumbs", () => {
    expect(p("New boiler £16.1k").estimatedPrice).toBe(16100);
    expect(p("Extension £32.3k-64.1k")).toMatchObject({ estimatedPrice: 32300, estimateMax: 64100 });
    expect(parseStep("Deposit £2.01k").cost).toBe(2010);
  });
  it("reads 'quid'", () => {
    expect(p("Paint 40 quid")).toMatchObject({ title: "Paint", estimatedPrice: 40 });
  });
  it("leaves numbers that aren't money in the title", () => {
    expect(p("Fit 2 shelves")).toMatchObject({ title: "Fit 2 shelves", estimatedPrice: null });
  });
});

describe("kind", () => {
  it("treats job verbs as jobs even with a price", () => {
    expect(p("Fix bathroom tap £40").kind).toBe("TASK");
    expect(p("Paint hallway £120").kind).toBe("TASK");
  });
  it("treats buy verbs as purchases", () => {
    expect(p("Buy curtain poles").kind).toBe("BUY");
    expect(p("Order new mattress").kind).toBe("BUY");
  });
  it("defaults to a job", () => {
    expect(p("Find the stopcock").kind).toBe("TASK");
  });
  it("treats work nouns anywhere in the title as jobs, even with a price", () => {
    expect(p("Boiler service every year £90").kind).toBe("TASK");
    expect(p("Chimney sweep £80").kind).toBe("TASK");
    expect(p("Carpet fitting £150").kind).toBe("TASK");
    expect(p("New doormat £25").kind).toBe("BUY");
  });
});

describe("priority", () => {
  it("! and !! and !must mean must", () => {
    expect(p("Smoke alarms !").priority).toBe("MUST_HAVE");
    expect(p("Smoke alarms !!").priority).toBe("MUST_HAVE");
    expect(p("Smoke alarms !must").priority).toBe("MUST_HAVE");
  });
  it("!someday and !want", () => {
    expect(p("Hot tub !someday").priority).toBe("SOMEDAY");
    expect(p("Rug !want").priority).toBe("WOULD_LIKE");
  });
  it("asap means must", () => {
    expect(p("Fix tap asap")).toMatchObject({ title: "Fix tap", priority: "MUST_HAVE" });
    expect(p("Fix tap ASAP !someday").priority).toBe("SOMEDAY");
  });
  it("doesn't eat exclamations inside words", () => {
    expect(p("Wow! new rug")).toMatchObject({ priority: null, title: "Wow! new rug" });
  });
});

describe("people", () => {
  it("matches household names case-insensitively", () => {
    expect(p("Bleed radiators @connor")).toMatchObject({ assignee: "Connor", title: "Bleed radiators" });
  });
  it("@both and tradespeople", () => {
    expect(p("Paint @both").assignee).toBe("Both");
    expect(p("Rewire @electrician").assignee).toBe("Electrician");
  });
  it("leaves email addresses alone", () => {
    expect(p("Email quote to bob@example.com").assignee).toBeNull();
  });
});

describe("dates", () => {
  it("today / tomorrow", () => {
    expect(p("Bins today").dueDate).toBe("2026-10-09");
    expect(p("Bins tomorrow")).toMatchObject({ title: "Bins", dueDate: "2026-10-10" });
  });
  it("weekdays roll forward", () => {
    expect(p("Call plumber by monday").dueDate).toBe("2026-10-12");
    expect(p("Call plumber on fri").dueDate).toBe("2026-10-16");
    expect(p("Call plumber friday").dueDate).toBe("2026-10-16");
  });
  it("doesn't read weekday-ish words as dates", () => {
    expect(p("Sat nav holder").dueDate).toBeNull();
    expect(p("Sun lounger").dueDate).toBeNull();
    expect(p("Wed pictures frame").dueDate).toBeNull();
  });
  it("this weekend / next week / next month / end of month", () => {
    expect(p("Mow lawn this weekend").dueDate).toBe("2026-10-10");
    expect(p("Mow lawn next week").dueDate).toBe("2026-10-12");
    expect(p("Mow lawn next month").dueDate).toBe("2026-11-01");
    expect(p("Mow lawn end of month").dueDate).toBe("2026-10-31");
  });
  it("in N days / weeks", () => {
    expect(p("Reseal bath in 3 days").dueDate).toBe("2026-10-12");
    expect(p("Reseal bath in 2 weeks").dueDate).toBe("2026-10-23");
  });
  it("next/this weekday, without leaving the word behind", () => {
    expect(p("Book electrician next friday")).toMatchObject({ title: "Book electrician", dueDate: "2026-10-16" });
    expect(p("Book electrician next mon").dueDate).toBe("2026-10-12");
    expect(p("Fix shed next sat").dueDate).toBe("2026-10-17");
    expect(p("Fix shed this sat")).toMatchObject({ title: "Fix shed", dueDate: "2026-10-10" });
    expect(p("Bins this friday").dueDate).toBe("2026-10-09");
  });
  it("in a week / a fortnight / N months, and end of the week", () => {
    expect(p("Clean gutters in a week")).toMatchObject({ title: "Clean gutters", dueDate: "2026-10-16" });
    expect(p("Clean gutters in a fortnight").dueDate).toBe("2026-10-23");
    expect(p("Service boiler in 3 months")).toMatchObject({ title: "Service boiler", dueDate: "2027-01-09" });
    expect(p("Paint fence by end of the week")).toMatchObject({ title: "Paint fence", dueDate: "2026-10-11" });
  });
  it("on the 15th", () => {
    expect(p("Call plumber on the 15th")).toMatchObject({ title: "Call plumber", dueDate: "2026-10-15" });
    expect(p("Pay window cleaner the 2nd").dueDate).toBe("2026-11-02");
    expect(p("Pay window cleaner the 2nd #hallway").dueDate).toBe("2026-11-02");
  });
  it("leaves 'the 2nd' alone mid-sentence, where it's a word, not a date", () => {
    expect(p("Fix the 2nd step on the stairs")).toMatchObject({ title: "Fix the 2nd step on the stairs", dueDate: null });
    expect(p("Paint the 3rd bedroom")).toMatchObject({ title: "Paint the 3rd bedroom", dueDate: null });
    expect(p("Fix the 2nd step by the 15th")).toMatchObject({ title: "Fix the 2nd step", dueDate: "2026-10-15" });
  });
  it("explicit dates, rolling into next year when passed", () => {
    expect(p("Gutters by 12 Nov").dueDate).toBe("2026-11-12");
    expect(p("Gutters nov 12").dueDate).toBe("2026-11-12");
    expect(p("Gutters 3rd march").dueDate).toBe("2027-03-03");
    expect(p("Gutters 12/11").dueDate).toBe("2026-11-12");
  });
  it("doesn't read fractions or sizes as dates", () => {
    expect(p("Buy 1/2 inch drill bit").dueDate).toBeNull();
  });
  it("doesn't read words that start like a month as dates", () => {
    expect(p("Buy 2 decking boards")).toMatchObject({ title: "Buy 2 decking boards", dueDate: null });
    expect(p("Order 20 marble tiles")).toMatchObject({ title: "Order 20 marble tiles", dueDate: null });
    expect(p("Buy 10 junction boxes")).toMatchObject({ title: "Buy 10 junction boxes", dueDate: null });
    expect(p("Fix decking 2 boards loose").dueDate).toBeNull();
    expect(p("Gutters 3rd sept").dueDate).toBe("2027-09-03");
    expect(p("Gutters june 4").dueDate).toBe("2027-06-04");
  });
});

describe("rooms", () => {
  it("recognises a room in passing without removing it", () => {
    expect(p("Fix bathroom tap")).toMatchObject({ title: "Fix bathroom tap", room: "BATHROOM_1" });
    expect(p("Clear the loft")).toMatchObject({ room: "ATTIC" });
    expect(p("Front garden hedge")).toMatchObject({ room: "FRONT_GARDEN" });
  });
  it("prefers the longest match", () => {
    expect(p("Spare room 2 blinds").room).toBe("SPARE_ROOM_2");
    expect(p("Bathroom 2 extractor").room).toBe("BATHROOM_2");
    expect(p("Master bedroom blinds").room).toBe("MASTER_BEDROOM");
    expect(p("Front garden gate").room).toBe("FRONT_GARDEN");
  });
  it("calls a job across several rooms the whole house", () => {
    expect(
      p("Install fire alarms, 1 office, 1 master bedroom, 1 hallway, 1 landing, heat alarm in kitchen").room,
    ).toBe("WHOLE_HOUSE");
    expect(p("Move the desk from the spare room to the loft").room).toBe("WHOLE_HOUSE");
    // Naming the same room twice is still one room.
    expect(p("Hall light and hallway rug").room).toBe("HALLWAY");
  });
  it("an explicit #tag beats rooms named in passing", () => {
    expect(p("Fire alarms in hallway and kitchen #landing").room).toBe("LANDING");
  });
  it("#tags are removed from the title", () => {
    expect(p("New lamp #sitting-room")).toMatchObject({ title: "New lamp", room: "SITTING_ROOM" });
    expect(p("Blind #bathroom2")).toMatchObject({ title: "Blind", room: "BATHROOM_2" });
    expect(p("Shelves #kitchen")).toMatchObject({ title: "Shelves", room: "KITCHEN" });
  });
  it("#tags can be several words, with nothing left behind", () => {
    expect(p("Buy sofa £600-900 #sitting room")).toMatchObject({ title: "Buy sofa", room: "SITTING_ROOM" });
    expect(p("Blind #spare room 1 tomorrow")).toMatchObject({ title: "Blind", room: "SPARE_ROOM_1" });
    expect(p("Shelves #kitchen wall")).toMatchObject({ title: "Shelves wall", room: "KITCHEN" });
  });
  it("doesn't match rooms inside other words", () => {
    expect(p("Hallmark card").room).toBeNull();
    expect(p("Test drive car").room).toBe("DRIVEWAY"); // known, acceptable: "drive" is an alias
  });
});

describe("everything at once", () => {
  it("parses the example from the hint", () => {
    expect(p("Fix bathroom tap £40 tomorrow !must @Sam")).toEqual({
      title: "Fix bathroom tap",
      kind: "TASK",
      room: "BATHROOM_1",
      priority: "MUST_HAVE",
      estimatedPrice: 40,
      estimateMax: null,
      dueDate: "2026-10-10",
      assignee: "Sam",
      repeat: null,
    });
  });
  it("capitalises the title and collapses spaces", () => {
    expect(p("  buy   bin bags  ").title).toBe("Buy bin bags");
  });
});

describe("repeats", () => {
  it("reads common phrasings and removes them from the title", () => {
    expect(p("Boiler service every year")).toMatchObject({ title: "Boiler service", repeat: "YEARLY" });
    expect(p("Test smoke alarms monthly")).toMatchObject({ title: "Test smoke alarms", repeat: "MONTHLY" });
    expect(p("Clean filters every 3 months").repeat).toBe("QUARTERLY");
    expect(p("Clean filters quarterly").repeat).toBe("QUARTERLY");
    expect(p("Clear gutters twice a year").repeat).toBe("TWICE_YEARLY");
    expect(p("Clear gutters every 6 months").repeat).toBe("TWICE_YEARLY");
    expect(p("Bins every week").repeat).toBe("WEEKLY");
    expect(p("Service boiler annually £90").repeat).toBe("YEARLY");
  });
  it("doesn't confuse repeats with due dates", () => {
    expect(p("Bins every week").dueDate).toBeNull();
    expect(p("Water plants weekly tomorrow")).toMatchObject({ repeat: "WEEKLY", dueDate: "2026-10-10" });
  });
});

describe("steps and pasted lists", () => {
  it("reads a price out of a step", () => {
    expect(parseStep("Deposit £200")).toEqual({ text: "Deposit", cost: 200 });
    expect(parseStep("Tiles £80-120")).toEqual({ text: "Tiles", cost: 120 });
    expect(parseStep("Measure the wall")).toEqual({ text: "Measure the wall", cost: null });
    expect(parseStep("£50")).toEqual({ text: "£50", cost: null });
  });
  it("cleans bullets, numbers and checkboxes from pasted lines", () => {
    expect(pastedLines("- Buy paint\n2. Fill cracks\n[ ] Sand\n\n• First coat")).toEqual([
      "Buy paint",
      "Fill cracks",
      "Sand",
      "First coat",
    ]);
  });
});

describe("shopping steps", () => {
  it("spots supplies inside jobs", () => {
    const step = (text: string, link: string | null = null, cost: number | null = null) => ({ text, link, cost });
    expect(isShoppingStep(step("Buy socket faceplates"))).toBe(true);
    expect(isShoppingStep(step("Pick up grout"))).toBe(true);
    expect(isShoppingStep(step("Faceplates", "https://screwfix.com/p/1", 45))).toBe(true);
    expect(isShoppingStep(step("Watch the how-to", "https://youtube.com/x"))).toBe(false);
    expect(isShoppingStep(step("Fit the sockets", null, 220))).toBe(false);
  });
});

describe("guessing a room from a product", () => {
  it("uses a room named in the title, then product words", () => {
    expect(guessRoom("GoodHome Kitchen Mixer Tap")).toBe("KITCHEN");
    expect(guessRoom("Mira Sport Max 9.8kW Electric Shower")).toBe("BATHROOM_1");
    expect(guessRoom("Bosch Cordless Lawnmower CityMower 18V")).toBe("BACK_GARDEN");
    expect(guessRoom("Argos Home Ava Fabric 3 Seater Sofa - Grey")).toBe("SITTING_ROOM");
  });
  it("leaves the rest alone", () => {
    expect(guessRoom("Dewalt DCD796 18V XR Brushless Combi Drill")).toBeNull();
    expect(guessRoom("Screwdriver set")).toBeNull();
  });
});

describe("the same thing worded differently", () => {
  it("matches a retyped title", () => {
    expect(
      sameThing(
        "Install fire alarms, 1 in office, 1 in hallway, 1 on landing, 1 in master bedroom, and a heat detector in kitchen",
        "Install fire alarms, 1 office, 1 master bedroom, 1 hallway, 1 landing, heat alarm in kitchen",
      ),
    ).toBe(true);
    expect(sameThing("Paint the hallway", "paint hallway")).toBe(true);
    expect(sameThing("Fix tap", "fix tap")).toBe(true);
  });
  it("keeps different jobs apart", () => {
    expect(sameThing("Paint hallway", "Paint hallway ceiling")).toBe(false);
    expect(sameThing("Paint hallway", "Paint landing")).toBe(false);
    expect(sameThing("Fix tap", "Fix bathroom tap")).toBe(false);
  });
  it("keeps numbered rooms apart", () => {
    expect(sameThing("Paint spare room 1", "Paint spare room 2")).toBe(false);
    expect(sameThing("Clean bathroom 1 extractor", "Clean bathroom 2 extractor")).toBe(false);
  });
});

describe("a job typed with a link", () => {
  it("reads job words at the start only", () => {
    expect(startsWithJobWord("Install fire alarms")).toBe(true);
    expect(startsWithJobWord("Fire alarm bundle")).toBe(false);
    expect(startsWithJobWord("")).toBe(false);
  });
});
