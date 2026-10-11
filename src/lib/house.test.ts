import { describe, expect, it } from "vitest";
import { ROOM_LAYOUT, houseForClaude, roomAreas, roomSizeLabel } from "@/lib/house";
import { buildPrompt } from "../../scripts/ai-worker-lib.mjs";

describe("house layout", () => {
  it("gives a measured room's size and areas", () => {
    expect(roomSizeLabel("MASTER_BEDROOM")).toBe("4.83 × 4.52 m");
    // 4.83 × 4.52 floor; perimeter 18.7 m at a 2.4 m ceiling.
    expect(roomAreas("MASTER_BEDROOM")).toEqual({ floorM2: 21.8, wallM2: 44.9 });
  });

  it("says when a size is only rough, and has none for rooms off the plan", () => {
    expect(roomSizeLabel("BATHROOM_1")).toMatch(/^about/);
    expect(roomSizeLabel("LANDING")).toBeNull();
    expect(roomAreas("ATTIC")).toBeNull();
  });

  it("picks out the item's room for Claude", () => {
    const house = houseForClaude("SPARE_ROOM_1");
    expect(house.thisRoom).toMatchObject({ room: "Spare room 1", onFloorPlan: "Bedroom 2", floor: "First floor" });
    expect(house.rooms).toHaveLength(Object.keys(ROOM_LAYOUT).length);
    expect(houseForClaude("BACK_GARDEN")).not.toHaveProperty("thisRoom");
    expect(houseForClaude("BATHROOM_2").thisRoom?.size).toMatch(/scaled off the drawing/);
  });

  it("goes into the worker's prompt, with how to use it", () => {
    const claim = {
      job: { id: "j1", kind: "RESEARCH_ITEM", question: null, attempts: 1 },
      item: { title: "Paint the master bedroom" },
      location: null,
      today: "2026-10-15",
    };
    expect(buildPrompt(claim)).not.toContain("<house>");
    const prompt = buildPrompt({ ...claim, house: houseForClaude("MASTER_BEDROOM") });
    expect(prompt).toContain("<house>");
    expect(prompt).toContain("4.83 m × 4.52 m");
    expect(prompt).toMatch(/measure first/);
  });
});
