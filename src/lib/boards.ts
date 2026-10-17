import type { Room } from "@/lib/types";

// A planning board is a free canvas in three wide bands, left to right:
// Ideas, Maybe, Decided. Moving a piece rightwards is deciding. Positions are
// in board units, CSS pixels at full size; nothing is stored about bands, a
// piece is in whichever band its middle is over.

export const BANDS = ["Ideas", "Maybe", "Decided"] as const;
export type Band = 0 | 1 | 2;
export const DECIDED: Band = 2;

/** One band's width: two pieces side by side, and one phone screen at the zoom a phone opens on. */
export const BAND_W = 480;
export const BOARD_W = BAND_W * BANDS.length;
/** Pieces snap to this grid when they're let go. */
export const GRID = 20;
/** Space above the first pieces, under the band names. */
export const TOP = 60;

export const PIECE_KINDS = ["PHOTO", "LINK", "ITEM", "NOTE", "SWATCH"] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];

export type PieceDTO = {
  id: string;
  boardId: string;
  kind: PieceKind;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  imageId: string | null;
  /** Width over height of the picture. */
  aspect: number | null;
  itemId: string | null;
  url: string | null;
  title: string | null;
  price: number | null;
  site: string | null;
  text: string | null;
  color: string | null;
  addedBy: string;
  createdAt: string;
};

export type BoardDTO = {
  id: string;
  name: string;
  room: Room | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  pieces: PieceDTO[];
};

export const BOARD_NAME_MAX = 60;
export const PIECES_MAX = 300;

/** Sizes a piece starts at, and the range it can be resized through. */
export const PIECE_WIDTH: Record<PieceKind, { start: number; min: number; max: number }> = {
  PHOTO: { start: 200, min: 120, max: 440 },
  LINK: { start: 200, min: 160, max: 400 },
  ITEM: { start: 220, min: 180, max: 400 },
  NOTE: { start: 180, min: 120, max: 400 },
  SWATCH: { start: 140, min: 110, max: 240 },
};

/**
 * A piece's height for its width. Photos keep their shape, notes stay
 * square; cards are measured by their content, so this is only the space
 * they're expected to take (for fitting the board on screen and for keeping
 * new pieces from landing on top of each other).
 */
export function heightFor(kind: PieceKind, w: number, aspect: number | null): number {
  switch (kind) {
    case "PHOTO":
      return Math.round(w / (aspect || 1));
    case "LINK":
      return Math.round(w / (aspect || 1.25)) + 118;
    case "ITEM":
      return aspect ? Math.round(w / aspect) + 124 : 140;
    case "NOTE":
      return w;
    case "SWATCH":
      return Math.round(w * 1.3);
  }
}

export const snap = (v: number) => Math.round(v / GRID) * GRID;

export function bandOf(piece: { x: number; w: number }): Band {
  const middle = piece.x + piece.w / 2;
  return Math.min(BANDS.length - 1, Math.max(0, Math.floor(middle / BAND_W))) as Band;
}

/** Where a piece lands when it's moved to another band: the same height, the same place across. */
export function moveToBand(piece: { x: number; w: number }, band: Band): number {
  const offset = Math.min(Math.max(piece.x - bandOf(piece) * BAND_W, GRID), BAND_W - piece.w - GRID);
  return snap(band * BAND_W + Math.max(GRID, offset));
}

/** Keeps a piece on the board: inside the three bands and below the band names. */
export function clampToBoard(x: number, y: number, w: number) {
  return { x: Math.min(Math.max(x, 0), BOARD_W - w), y: Math.max(y, TOP) };
}

/** The pieces' extent, for fitting the board on screen. */
export function boardBounds(pieces: { x: number; y: number; w: number; h: number }[]) {
  const bottom = pieces.reduce((max, p) => Math.max(max, p.y + p.h), TOP + 400);
  return { width: BOARD_W, height: bottom + TOP };
}

type Rect = { x: number; y: number; w: number; h: number };

const overlaps = (a: Rect, b: Rect, gap = GRID / 2) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/**
 * Where a new piece goes: the first free space in the part of the board on
 * screen, reading left to right and down, so it lands in view without
 * covering anything. With no room on screen, it goes under whatever is
 * already in that column.
 */
export function placeFree(pieces: Rect[], view: Rect, w: number, h: number): { x: number; y: number } {
  const left = snap(Math.max(GRID, view.x + GRID));
  const right = Math.min(BOARD_W - GRID, view.x + view.w - GRID);
  const top = snap(Math.max(TOP, view.y + GRID));
  const bottom = view.y + view.h - GRID;
  for (let y = top; y + h <= bottom; y += GRID) {
    for (let x = left; x + w <= right; x += GRID) {
      if (!pieces.some((p) => overlaps({ x, y, w, h }, p))) return { x, y };
    }
  }
  const x = clampToBoard(left, 0, w).x;
  const below = pieces.filter((p) => p.x < x + w && x < p.x + p.w).reduce((max, p) => Math.max(max, p.y + p.h), top - GRID);
  return { x, y: snap(below + GRID) };
}

/** The first line of a note, for naming what it becomes on the list. */
export function pieceName(piece: Pick<PieceDTO, "kind" | "title" | "text">): string {
  if (piece.title?.trim()) return piece.title.trim();
  if (piece.kind === "NOTE" && piece.text) return piece.text.trim().split("\n")[0].slice(0, 200);
  return "";
}

/** Readable #rrggbb, or null. */
export function normaliseColour(raw: string): string | null {
  const m = raw.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${hex.toLowerCase()}`;
}
