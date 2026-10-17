import { describe, expect, it } from "vitest";
import { itemLines, lineLabels, lineState, listLines, stepLines, type PrintLine } from "./printouts";
import type { ItemDTO } from "./types";

const step = (id: string, text: string, done = false) => ({ id, text, done, cost: null, link: null, notes: null, potCharge: null, doneAt: null });

function item(over: Partial<ItemDTO>): ItemDTO {
  return {
    id: "i",
    title: "Item",
    kind: "TASK",
    room: "KITCHEN",
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
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    steps: [],
    pinned: false,
    quotes: [],
    comments: [],
    photos: [],
    ...over,
  } as ItemDTO;
}

describe("print lines", () => {
  const shed = item({ id: "shed", title: "Shed", steps: [step("s1", "Base", true), step("s2", "Walls"), step("s3", "Roof")] });

  it("prints an item with only its steps still to do", () => {
    expect(itemLines(shed, "Back garden")).toEqual([
      { itemId: "shed", text: "Shed", group: "Back garden" },
      { itemId: "shed", stepId: "s2", text: "Walls", group: "Back garden" },
      { itemId: "shed", stepId: "s3", text: "Roof", group: "Back garden" },
    ]);
  });

  it("leaves finished things off", () => {
    expect(listLines([{ label: null, items: [item({ status: "DONE" }), item({ id: "tap", title: "Tap" })] }])).toHaveLength(1);
  });

  it("numbers jobs, and letters the steps under them", () => {
    const lines = [...itemLines(item({ id: "tap", title: "Tap" })), ...itemLines(shed)];
    expect(lineLabels(lines)).toEqual(["1", "2", "2a", "2b"]);
  });

  it("numbers one job's steps on their own", () => {
    expect(lineLabels(stepLines(shed))).toEqual(["1", "2"]);
  });
});

describe("lineState", () => {
  const shed = item({ id: "shed", steps: [step("s1", "Base", true), step("s2", "Walls")] });
  const byId = new Map([["shed", shed]]);
  const line = (over: Partial<PrintLine>): PrintLine => ({ itemId: "shed", text: "x", ...over });

  it("says what's still to do, done already, or gone", () => {
    expect(lineState(line({}), byId)).toEqual({ kind: "open" });
    expect(lineState(line({ stepId: "s1" }), byId)).toEqual({ kind: "done", by: null });
    expect(lineState(line({ stepId: "s2" }), byId)).toEqual({ kind: "open" });
    expect(lineState(line({ stepId: "gone" }), byId)).toEqual({ kind: "gone" });
    expect(lineState(line({ itemId: "deleted" }), byId)).toEqual({ kind: "gone" });
  });

  it("counts a finished job's steps as done", () => {
    const done = new Map([["shed", { ...shed, status: "DONE" as const, completedBy: "Sam" }]]);
    expect(lineState(line({}), done)).toEqual({ kind: "done", by: "Sam" });
    expect(lineState(line({ stepId: "s2" }), done)).toEqual({ kind: "done", by: null });
  });
});
