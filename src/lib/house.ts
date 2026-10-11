import type { Room } from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";

// The house itself, from the estate agent's floor plan: which floor each room
// is on, its size, and what's in it worth knowing when pricing a job (a
// chimney breast, French doors). Claude gets this with every question, so
// "paint the master bedroom" comes back as litres for that room, not a guess.
// One house, so it lives here rather than in the database: edit it here.

export type Floor = "ground" | "first";

export type RoomLayout = {
  floor: Floor;
  /** What the floor plan calls it, where that differs from the app. */
  planName?: string;
  /** Metres, the room's longest measurements as the plan gives them. */
  size?: { width: number; length: number; imperial: string };
  /** No measurement on the plan: a size scaled off the drawing, only roughly right. */
  rough?: { width: number; length: number };
  features?: string[];
};

export const FLOOR_LABELS: Record<Floor, string> = { ground: "Ground floor", first: "First floor" };

/** Not measured: a typical UK ceiling, for wall areas. */
export const CEILING_M = 2.4;

export const HOUSE = {
  summary:
    "A two-storey house in the UK with about 129 m² (1,390 sq ft) of floor space, four bedrooms (one used as a sitting room) and two bathrooms.",
  totalAreaM2: 129.1,
};

export const ROOM_LAYOUT: Partial<Record<Room, RoomLayout>> = {
  SITTING_ROOM: {
    floor: "ground",
    planName: "Living room / bedroom 4",
    size: { width: 3.3, length: 5.44, imperial: "10'10\" × 17'10\"" },
    features: ["Chimney breast on the side wall", "Windows front and back"],
  },
  KITCHEN: {
    floor: "ground",
    size: { width: 4.25, length: 3.52, imperial: "13'11\" × 11'7\"" },
    features: ["Back door to the garden"],
  },
  GAMES_ROOM: {
    floor: "ground",
    planName: "Family room",
    size: { width: 4.82, length: 4.52, imperial: "15'10\" × 14'10\"" },
    features: ["French doors to the back garden"],
  },
  HALLWAY: { floor: "ground", features: ["Front door", "Stairs up to the landing"] },
  UNDERSTAIR_CUPBOARD: { floor: "ground", planName: "Cupboard under the stairs" },
  MASTER_BEDROOM: {
    floor: "first",
    planName: "Bedroom 1",
    size: { width: 4.83, length: 4.52, imperial: "15'10\" × 14'10\"" },
    features: ["Ensuite (Bathroom 2) off it"],
  },
  SPARE_ROOM_1: {
    floor: "first",
    planName: "Bedroom 2",
    size: { width: 4.51, length: 2.85, imperial: "14'10\" × 9'4\"" },
    features: ["Chimney breast on the side wall"],
  },
  SPARE_ROOM_2: {
    floor: "first",
    planName: "Bedroom 3",
    size: { width: 3.0, length: 2.54, imperial: "9'10\" × 8'4\"" },
    features: ["Two built-in cupboards", "Not a plain rectangle: the size is at its widest"],
  },
  BATHROOM_1: { floor: "first", planName: "Bathroom", rough: { width: 2.0, length: 1.9 } },
  BATHROOM_2: { floor: "first", planName: "Ensuite", rough: { width: 2.1, length: 2.7 }, features: ["Off the master bedroom"] },
  LANDING: { floor: "first", features: ["Top of the stairs"] },
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** "4.83 × 4.52 m", or a rough size, or null when the plan doesn't say. */
export function roomSizeLabel(room: Room): string | null {
  const layout = ROOM_LAYOUT[room];
  if (layout?.size) return `${layout.size.width.toFixed(2)} × ${layout.size.length.toFixed(2)} m`;
  if (layout?.rough) return `about ${layout.rough.width} × ${layout.rough.length} m`;
  return null;
}

/** Floor and wall areas for a measured or roughly sized room. */
export function roomAreas(room: Room) {
  const layout = ROOM_LAYOUT[room];
  const dims = layout?.size ?? layout?.rough;
  if (!dims) return null;
  return {
    floorM2: round1(dims.width * dims.length),
    // Before taking off doors and windows.
    wallM2: round1(2 * (dims.width + dims.length) * CEILING_M),
  };
}

/** One room, as Claude reads it. */
function describeRoom(room: Room) {
  const layout = ROOM_LAYOUT[room];
  if (!layout) return null;
  const areas = roomAreas(room);
  return {
    room: ROOM_PAINT[room].label,
    ...(layout.planName ? { onFloorPlan: layout.planName } : {}),
    floor: FLOOR_LABELS[layout.floor],
    ...(layout.size
      ? { size: `${layout.size.width.toFixed(2)} m × ${layout.size.length.toFixed(2)} m (${layout.size.imperial}), at its longest` }
      : layout.rough
        ? { size: `roughly ${layout.rough.width} m × ${layout.rough.length} m, scaled off the drawing rather than measured` }
        : { size: "not measured on the floor plan" }),
    ...(areas ? { floorArea: `about ${areas.floorM2} m²`, wallArea: `about ${areas.wallM2} m² before doors and windows` } : {}),
    ...(layout.features?.length ? { features: layout.features } : {}),
  };
}

/**
 * The house as Claude reads it, for research (the worker) and the connector:
 * the whole layout, and the item's own room picked out when it's on the plan.
 */
export function houseForClaude(room?: Room) {
  return {
    summary: HOUSE.summary,
    measurements: `From the estate agent's floor plan, so approximate. Ceiling heights aren't on it: wall areas assume ${CEILING_M} m. Window and door sizes aren't recorded.`,
    rooms: (Object.keys(ROOM_LAYOUT) as Room[]).map((r) => describeRoom(r)!),
    notOnThePlan: "The attic, gardens and driveway: no sizes recorded.",
    ...(room && ROOM_LAYOUT[room] ? { thisRoom: describeRoom(room) } : {}),
  };
}
