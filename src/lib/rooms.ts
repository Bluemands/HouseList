import type { Room } from "@/lib/types";

// Every room owns a paint. These are the only saturated colours in the app:
// they mark which room a row belongs to and fill a room's swatch card as its
// jobs get done. The names are invented, paint-chart style.
type RoomPaint = {
  label: string;
  paint: string;
  /** Paint-card number, "No. 04". */
  number: string;
  hex: string;
  /** Text colour that reads on the paint itself. */
  ink: string;
  /** Short words the quick-add box recognises for this room. */
  aliases: string[];
};

const DARK_INK = "#211f1b";
const LIGHT_INK = "#ffffff";

function inkFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum =
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  // Pick whichever ink has the better contrast against the paint.
  const vsWhite = 1.05 / (lum + 0.05);
  const vsDark = (lum + 0.05) / (0.0137 + 0.05); // #211f1b has luminance ~0.0137
  return vsDark >= vsWhite ? DARK_INK : LIGHT_INK;
}

let paintNo = 0;
function paint(label: string, paintName: string, hex: string, aliases: string[]): RoomPaint {
  paintNo += 1;
  const number = `No. ${String(paintNo).padStart(2, "0")}`;
  return { label, paint: paintName, number, hex, ink: inkFor(hex), aliases };
}

export const ROOM_PAINT: Record<Room, RoomPaint> = {
  WHOLE_HOUSE: paint("Whole house", "Plaster", "#d9ccb9", ["whole house", "house", "everywhere"]),
  HALLWAY: paint("Hallway", "Hall Stone", "#b8a184", ["hallway", "hall"]),
  SITTING_ROOM: paint("Sitting room", "Moss", "#879360", ["sitting room", "living room", "lounge"]),
  KITCHEN: paint("Kitchen", "Sage", "#9db39a", ["kitchen"]),
  GAMES_ROOM: paint("Games room", "Billiard", "#2f5e4e", ["games room"]),
  UNDERSTAIR_CUPBOARD: paint("Understair cupboard", "Mousehole", "#958c7f", [
    "understair cupboard",
    "understairs",
    "under the stairs",
  ]),
  LANDING: paint("Landing", "Skylight", "#a9c3d3", ["landing"]),
  SPARE_ROOM_1: paint("Spare room 1", "Lavender", "#b3a6cb", ["spare room 1", "spare room", "spare 1"]),
  SPARE_ROOM_2: paint("Spare room 2", "Apricot", "#e6b48a", ["spare room 2", "spare 2"]),
  MASTER_BEDROOM: paint("Master bedroom", "Midnight", "#33405f", [
    "master bedroom",
    "our bedroom",
    "bedroom",
  ]),
  BATHROOM_1: paint("Bathroom 1", "Seafoam", "#94c7bd", ["bathroom 1", "bathroom", "bath 1"]),
  BATHROOM_2: paint("Bathroom 2", "Tile Blue", "#5f8fb3", ["bathroom 2", "ensuite", "en-suite", "bath 2"]),
  BACK_GARDEN: paint("Back garden", "Fern", "#5c7d45", ["back garden", "garden"]),
  FRONT_GARDEN: paint("Front garden", "Lichen", "#bdb86c", ["front garden"]),
  DRIVEWAY: paint("Driveway", "Slate", "#5f6368", ["driveway", "drive"]),
  ATTIC: paint("Attic", "Rafter", "#a5683f", ["attic", "loft"]),
};

export function roomLabel(room: Room): string {
  return ROOM_PAINT[room].label;
}
