import { describe, expect, it } from "vitest";
import { BAND_W, BOARD_W, GRID, TOP, bandOf, clampToBoard, heightFor, moveToBand, normaliseColour, pieceName, placeFree } from "@/lib/boards";

describe("bandOf", () => {
  it("goes by the piece's middle", () => {
    expect(bandOf({ x: 0, w: 200 })).toBe(0);
    // Mostly over Maybe, though it starts in Ideas.
    expect(bandOf({ x: BAND_W - 60, w: 200 })).toBe(1);
    expect(bandOf({ x: BAND_W * 2 + 20, w: 200 })).toBe(2);
  });

  it("keeps a piece past either edge in the outer bands", () => {
    expect(bandOf({ x: -500, w: 200 })).toBe(0);
    expect(bandOf({ x: BOARD_W + 500, w: 200 })).toBe(2);
  });
});

describe("moveToBand", () => {
  it("keeps its place across the band, on the grid", () => {
    const x = moveToBand({ x: 140, w: 200 }, 2);
    expect(bandOf({ x, w: 200 })).toBe(2);
    expect(x).toBe(BAND_W * 2 + 140);
    expect(x % GRID).toBe(0);
  });

  it("keeps a wide piece inside the band it goes to", () => {
    const x = moveToBand({ x: BAND_W - 100, w: 400 }, 0);
    expect(x + 400).toBeLessThanOrEqual(BAND_W);
  });
});

describe("clampToBoard", () => {
  it("keeps pieces on the board and below the band names", () => {
    expect(clampToBoard(-40, 0, 200)).toEqual({ x: 0, y: TOP });
    expect(clampToBoard(BOARD_W, 400, 200)).toEqual({ x: BOARD_W - 200, y: 400 });
  });
});

describe("placeFree", () => {
  const screen = { x: 0, y: 0, w: BAND_W, h: 800 };

  it("starts at the top left of what's on screen", () => {
    expect(placeFree([], screen, 200, 200)).toEqual({ x: GRID, y: TOP });
  });

  it("goes beside, then under, what's there without covering it", () => {
    const first = { x: GRID, y: TOP, w: 200, h: 200 };
    const beside = placeFree([first], screen, 200, 200);
    expect(beside.y).toBe(TOP);
    expect(beside.x).toBeGreaterThanOrEqual(first.x + first.w);
    const under = placeFree([first, { ...beside, w: 200, h: 200 }], screen, 200, 200);
    expect(under.y).toBeGreaterThanOrEqual(TOP + 200);
  });

  it("goes below everything in the column when the screen is full", () => {
    const tall = { x: 0, y: TOP, w: BAND_W, h: 2000 };
    expect(placeFree([tall], screen, 200, 200).y).toBeGreaterThan(TOP + 2000);
  });
});

describe("heightFor", () => {
  it("keeps a photo's shape and a note square", () => {
    expect(heightFor("PHOTO", 200, 2)).toBe(100);
    expect(heightFor("NOTE", 180, null)).toBe(180);
  });
});

describe("pieceName", () => {
  it("prefers a title, then a note's first line", () => {
    expect(pieceName({ kind: "LINK", title: " Velvet sofa ", text: null })).toBe("Velvet sofa");
    expect(pieceName({ kind: "NOTE", title: null, text: "Paint the hall\nsage, not grey" })).toBe("Paint the hall");
    expect(pieceName({ kind: "PHOTO", title: null, text: null })).toBe("");
  });
});

describe("normaliseColour", () => {
  it("reads colour codes as people type them", () => {
    expect(normaliseColour("#9DB39A")).toBe("#9db39a");
    expect(normaliseColour("abc")).toBe("#aabbcc");
    expect(normaliseColour("sage")).toBeNull();
  });
});
