"use client";

import type { Room } from "@/lib/types";
import type { RoomStats } from "@/lib/plan";
import { ROOM_PAINT } from "@/lib/rooms";
import { FLOOR_LABELS, roomSizeLabel, type Floor } from "@/lib/house";
import { formatGBPShort } from "@/lib/format";

// The house from above, traced from the estate agent's floor plan: each room
// in its own paint, so where the work is shows at a glance. Rooms with
// nothing in them are a pale wash of their paint. Drawn to the plan's
// shapes, not to scale.

const W = 466;
const H = 206;

type Shape = {
  room: Room;
  /** Polygon points in plan units (W × H per floor). */
  points: [number, number][];
  /** Where the label sits; none for a room too small to carry one. */
  label?: { x: number; y: number; text: string; narrow?: boolean };
};

const rect = (x: number, y: number, w: number, h: number): [number, number][] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

const FLOORS: { floor: Floor; shapes: Shape[]; stairs: { x: number; y: number; w: number; h: number; across?: boolean }; fixtures?: [number, number, number, number][] }[] = [
  {
    floor: "ground",
    shapes: [
      { room: "SITTING_ROOM", points: rect(0, 0, 125, 206), label: { x: 62, y: 103, text: "Sitting room" } },
      { room: "KITCHEN", points: rect(125, 0, 156, 135), label: { x: 203, y: 68, text: "Kitchen" } },
      { room: "GAMES_ROOM", points: rect(281, 0, 185, 206), label: { x: 373, y: 103, text: "Games room" } },
      {
        room: "HALLWAY",
        points: [
          [125, 135],
          [281, 135],
          [281, 170],
          [253, 170],
          [253, 206],
          [125, 206],
        ],
        label: { x: 153, y: 172, text: "Hall", narrow: true },
      },
      { room: "UNDERSTAIR_CUPBOARD", points: rect(253, 170, 28, 36) },
    ],
    stairs: { x: 181, y: 138, w: 72, h: 30, across: true },
  },
  {
    floor: "first",
    shapes: [
      {
        room: "SPARE_ROOM_2",
        points: [
          [0, 0],
          [115, 0],
          [115, 66],
          [175, 66],
          [175, 95],
          [0, 95],
        ],
        label: { x: 57, y: 47, text: "Spare 2" },
      },
      { room: "BATHROOM_1", points: rect(143, 0, 74, 66), label: { x: 180, y: 34, text: "Bath 1", narrow: true } },
      { room: "BATHROOM_2", points: rect(217, 0, 80, 105), label: { x: 257, y: 52, text: "Bath 2", narrow: true } },
      {
        room: "MASTER_BEDROOM",
        points: [
          [297, 0],
          [466, 0],
          [466, 206],
          [297, 206],
          [297, 137],
          [217, 137],
          [217, 105],
          [297, 105],
        ],
        label: { x: 382, y: 103, text: "Master" },
      },
      { room: "SPARE_ROOM_1", points: rect(0, 95, 175, 111), label: { x: 87, y: 150, text: "Spare 1" } },
      {
        room: "LANDING",
        points: [
          [175, 66],
          [217, 66],
          [217, 137],
          [297, 137],
          [297, 206],
          [175, 206],
        ],
        label: { x: 207, y: 174, text: "Landing", narrow: true },
      },
    ],
    stairs: { x: 240, y: 140, w: 57, h: 66 },
    // Bedroom 3's two built-in cupboards.
    fixtures: [[115, 0, 28, 66]],
  },
];

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

export function FloorPlan({ stats, onOpen }: { stats: RoomStats[]; onOpen: (room: Room) => void }) {
  const byRoom = new Map(stats.map((s) => [s.room, s]));

  return (
    <section aria-label="Floor plan" className="grid gap-4 rounded-[16px] border border-line bg-surface p-3 sm:grid-cols-2 sm:p-4">
      {FLOORS.map(({ floor, shapes, stairs, fixtures }) => (
        <figure key={floor} className="grid gap-1.5">
          <figcaption className="text-[12px] font-semibold text-ink-2">{FLOOR_LABELS[floor]}</figcaption>
          <div className="relative" style={{ aspectRatio: `${W} / ${H}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible">
              {fixtures?.map(([x, y, w, h], i) => (
                <rect key={i} x={x} y={y} width={w} height={h} className="fill-(--sunken) stroke-(--surface)" strokeWidth={3} />
              ))}
              {shapes.map(({ room, points }) => {
                const s = byRoom.get(room);
                const paint = ROOM_PAINT[room];
                const size = roomSizeLabel(room);
                const open = s?.open ?? 0;
                const status = !s?.total ? "nothing yet" : open ? `${open} to do` : "all done";
                return (
                  <polygon
                    key={room}
                    points={points.map((p) => p.join(",")).join(" ")}
                    role="button"
                    tabIndex={0}
                    aria-label={`${paint.label}${size ? `, ${size}` : ""}: ${status}`}
                    onClick={() => onOpen(room)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(room);
                      }
                    }}
                    fill={paint.hex}
                    fillOpacity={s?.total ? 1 : 0.3}
                    strokeWidth={3}
                    strokeLinejoin="round"
                    className="cursor-pointer stroke-(--surface) outline-none transition-opacity duration-150 hover:opacity-85 focus-visible:stroke-(--accent)"
                  />
                );
              })}
              <Stairs {...stairs} />
            </svg>
            {shapes.map(({ room, label }) => {
              if (!label) return null;
              const s = byRoom.get(room);
              const paint = ROOM_PAINT[room];
              const busy = !!s?.total;
              const line = !s?.total
                ? null
                : s.open === 0
                  ? "All done"
                  : `${s.open} to do${!label.narrow && s.openCost > 0 ? ` · ${formatGBPShort(s.openCost)}` : ""}`;
              return (
                <span
                  key={room}
                  aria-hidden="true"
                  className="pointer-events-none absolute grid -translate-x-1/2 -translate-y-1/2 text-center text-[11px] leading-[1.2] whitespace-nowrap"
                  style={{ left: pct(label.x, W), top: pct(label.y, H), color: busy ? paint.ink : "var(--ink-2)" }}
                >
                  <span className="font-semibold">{label.text}</span>
                  {line && <span className="tabular">{line}</span>}
                </span>
              );
            })}
          </div>
        </figure>
      ))}
    </section>
  );
}

/** Stair treads, drawn faintly over the hall or landing. */
function Stairs({ x, y, w, h, across }: { x: number; y: number; w: number; h: number; across?: boolean }) {
  const steps = across ? Math.round(w / 8) : Math.round(h / 8);
  return (
    <g aria-hidden="true" className="pointer-events-none stroke-(--ink)" strokeOpacity={0.22} strokeWidth={1.2} fill="none">
      <rect x={x} y={y} width={w} height={h} />
      {Array.from({ length: steps - 1 }, (_, i) =>
        across ? (
          <line key={i} x1={x + ((i + 1) * w) / steps} y1={y} x2={x + ((i + 1) * w) / steps} y2={y + h} />
        ) : (
          <line key={i} x1={x} y1={y + ((i + 1) * h) / steps} x2={x + w} y2={y + ((i + 1) * h) / steps} />
        ),
      )}
    </g>
  );
}
