"use client";

import { ViewTransition } from "react";
import clsx from "clsx";
import { ROOM_PAINT } from "@/lib/rooms";
import type { Room } from "@/lib/types";
import type { RoomStats } from "@/lib/plan";
import { formatGBPShort } from "@/lib/format";

const MAX_CELLS = 12;

/**
 * A room's paint, filling the box behind whatever sits in it. Swatches and
 * the room's header share it by name, so opening a room grows the one into
 * the other. Content over it needs `relative` to stay on top.
 */
export function PaintFill({ room, className }: { room: Room; className?: string }) {
  return (
    <ViewTransition name={`paint-${room}`} share="paint-morph" default="none">
      <span
        aria-hidden="true"
        className={clsx("absolute inset-0", className)}
        style={{ background: ROOM_PAINT[room].hex }}
      />
    </ViewTransition>
  );
}

/** One cell per job, painted in as each is done; long lists become a bar. */
export function PaintStrip({ stats, className, tall }: { stats: RoomStats; className?: string; tall?: boolean }) {
  const paint = ROOM_PAINT[stats.room];
  const h = tall ? "h-2" : "h-1.5";
  if (stats.total === 0) {
    return <div className={clsx(h, "rounded-cell border border-dashed border-line-strong", className)} />;
  }
  if (stats.total > MAX_CELLS) {
    return (
      <div className={clsx(h, "flex gap-[2px] overflow-hidden rounded-cell", className)}>
        {stats.done > 0 && (
          <div className="paint-in rounded-cell" style={{ flex: stats.done, background: paint.hex }} />
        )}
        {stats.open > 0 && <div className="rounded-cell bg-line" style={{ flex: stats.open }} />}
      </div>
    );
  }
  return (
    <div className={clsx(h, "flex gap-[2px]", className)} aria-hidden="true">
      {Array.from({ length: stats.total }, (_, i) => (
        <div
          key={i}
          className={clsx("flex-1 rounded-cell", i < stats.done ? "paint-in" : "bg-line")}
          style={i < stats.done ? { background: paint.hex, animationDelay: `${i * 40}ms` } : undefined}
        />
      ))}
    </div>
  );
}

export function SwatchCard({
  stats,
  onOpen,
  compact,
}: {
  stats: RoomStats;
  onOpen: () => void;
  compact?: boolean;
}) {
  const paint = ROOM_PAINT[stats.room];
  const empty = stats.total === 0;
  const finished = stats.total > 0 && stats.open === 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx(
        "group flex shrink-0 flex-col overflow-hidden rounded-card border border-line bg-surface text-left transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-pop",
        compact ? "w-[148px] lg:w-full" : "w-full",
      )}
    >
      <div
        className={clsx("relative flex items-end p-2.5", compact ? "h-[68px]" : "h-[88px]")}
        style={{ color: paint.ink }}
      >
        <PaintFill room={stats.room} className="rounded-t-[13px]" />
        <span className="relative grid text-label leading-tight font-semibold tracking-[0.02em]">
          <span className="tabular">{paint.number}</span>
          {paint.paint}
        </span>
        {stats.overdue > 0 && (
          <span className="absolute top-2 right-2 rounded-full bg-surface px-1.5 py-px text-label font-bold text-danger">
            {stats.overdue} late
          </span>
        )}
      </div>
      <div className="grid gap-1.5 p-2.5">
        <span className="truncate text-supporting font-semibold text-ink">{paint.label}</span>
        <span className="text-meta text-ink-2 tabular">
          {empty
            ? "Nothing yet"
            : finished
              ? `All ${stats.done} done`
              : `${stats.open} to do${stats.openCost > 0 ? ` · ${formatGBPShort(stats.openCost)}` : ""}`}
        </span>
        <PaintStrip stats={stats} />
      </div>
    </button>
  );
}
