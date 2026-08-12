"use client";

import { PRIORITIES, PRIORITY_LABELS, ROOMS, ROOM_LABELS, STATUSES, STATUS_LABELS } from "@/lib/types";
import type { Priority, Room, SortKey, Status } from "@/lib/types";
import { X } from "lucide-react";

type FilterBarProps = {
  priority: Priority[];
  room: Room[];
  status: Status[];
  sort: SortKey;
  onTogglePriority: (value: Priority) => void;
  onToggleRoom: (value: Room) => void;
  onToggleStatus: (value: Status) => void;
  onSortChange: (value: SortKey) => void;
  onClear: () => void;
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "recent", label: "Most recently added" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday ${
        active
          ? "border-someday bg-someday text-someday-ink"
          : "border-blueprint-border text-blueprint-ink-muted hover:border-blueprint-ink-muted hover:text-blueprint-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function FilterBar({
  priority,
  room,
  status,
  sort,
  onTogglePriority,
  onToggleRoom,
  onToggleStatus,
  onSortChange,
  onClear,
}: FilterBarProps) {
  const activeCount = priority.length + room.length + status.length;

  return (
    <section aria-label="Filter and sort" className="space-y-3">
      <div>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-blueprint-ink-faint">
          Priority
        </h2>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {PRIORITIES.map((p) => (
            <Chip key={p} active={priority.includes(p)} onClick={() => onTogglePriority(p)}>
              {PRIORITY_LABELS[p]}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-blueprint-ink-faint">
          Status
        </h2>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Chip key={s} active={status.includes(s)} onClick={() => onToggleStatus(s)}>
              {STATUS_LABELS[s]}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-blueprint-ink-faint">
          Room
        </h2>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {ROOMS.map((r) => (
            <Chip key={r} active={room.includes(r)} onClick={() => onToggleRoom(r)}>
              {ROOM_LABELS[r]}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <label className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-blueprint-ink-faint">
            Sort
          </span>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            className="rounded border border-blueprint-border bg-blueprint-bg px-2.5 py-1.5 text-sm text-blueprint-ink outline-none focus-visible:ring-2 focus-visible:ring-someday"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 rounded font-mono text-xs text-blueprint-ink-muted hover:text-blueprint-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-someday"
          >
            <X size={13} strokeWidth={2} aria-hidden="true" />
            Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
          </button>
        )}
      </div>
    </section>
  );
}
