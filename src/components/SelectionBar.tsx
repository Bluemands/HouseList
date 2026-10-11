"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Flag, LayoutGrid, Trash2, User, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { PRIORITIES, PRIORITY_LABELS, ROOMS, type ItemDTO } from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";
import { formatGBP } from "@/lib/format";
import { Chip, PaintChip } from "@/components/ui";

type Menu = "room" | "priority" | "who";

/**
 * What to do with everything selected in the list: finish it, move it, set
 * its priority or who's on it, or delete it — each with one undo.
 */
export function SelectionBar({
  selected,
  total,
  onToggleAll,
  onExit,
}: {
  selected: ItemDTO[];
  total: number;
  onToggleAll: () => void;
  onExit: () => void;
}) {
  const { bulkEdit, removeItems, settings, me } = useStore();
  const [menu, setMenu] = useState<Menu | null>(null);
  const n = selected.length;
  const things = (count: number) => `${count} ${count === 1 ? "thing" : "things"}`;
  const people = [...new Set([...settings.members, me]), "Both"];
  // A chip shows as on when everything selected already has that value.
  const all = (has: (i: ItemDTO) => boolean) => n > 0 && selected.every(has);

  function apply(patch: Parameters<typeof bulkEdit>[1], message: string) {
    bulkEdit(selected, patch, message);
    onExit();
  }

  function finish() {
    const cost = selected.reduce((sum, i) => sum + (i.actualPrice ?? i.estimatedPrice ?? 0), 0);
    const spends = settings.potTracked && cost > 0;
    apply({ status: "DONE" }, `Marked ${things(n)} done${spends ? ` — ${formatGBP(cost)} out of the pot` : ""}`);
  }

  const action = (label: string, icon: React.ReactNode, onClick: () => void, opts?: { danger?: boolean; menu?: Menu }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!n}
      aria-label={label}
      title={label}
      aria-expanded={opts?.menu ? menu === opts.menu : undefined}
      className={clsx(
        "grid h-10 w-10 place-items-center rounded-xl transition-colors disabled:opacity-40",
        opts?.menu && menu === opts.menu ? "bg-accent-soft text-accent-text" : "hover:bg-sunken",
        opts?.danger ? "text-danger" : "text-ink",
      )}
    >
      {icon}
    </button>
  );

  return (
    <div
      role="region"
      aria-label="Selected items"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-40 px-3 lg:bottom-6 lg:left-[240px]"
    >
      <div className="mx-auto grid max-w-[760px] gap-2 rounded-2xl border border-line bg-surface p-2 shadow-pop">
        {menu && n > 0 && (
          <div className="rail flex gap-1.5 overflow-x-auto px-1 pt-1">
            {menu === "room" &&
              ROOMS.map((room) => (
                <Chip key={room} selected={all((i) => i.room === room)} onClick={() => apply({ room }, `Moved ${things(n)} to ${ROOM_PAINT[room].label}`)}>
                  <PaintChip room={room} />
                  {ROOM_PAINT[room].label}
                </Chip>
              ))}
            {menu === "priority" &&
              PRIORITIES.map((priority) => (
                <Chip
                  key={priority}
                  selected={all((i) => i.priority === priority)}
                  onClick={() => apply({ priority }, `Set ${things(n)} to “${PRIORITY_LABELS[priority]}”`)}
                >
                  {PRIORITY_LABELS[priority]}
                </Chip>
              ))}
            {menu === "who" && (
              <>
                {people.map((p) => (
                  <Chip key={p} selected={all((i) => i.assignee === p)} onClick={() => apply({ assignee: p }, `Gave ${things(n)} to ${p === me ? "you" : p}`)}>
                    {p === me ? `${p} (you)` : p}
                  </Chip>
                ))}
                <Chip selected={all((i) => !i.assignee)} onClick={() => apply({ assignee: null }, `Took ${things(n)} off everyone`)}>Nobody</Chip>
              </>
            )}
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExit}
            aria-label="Stop selecting"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <X size={18} />
          </button>
          <span className="min-w-0 truncate text-[14px] font-semibold tabular" aria-live="polite">
            {n} selected
          </span>
          <button
            type="button"
            onClick={onToggleAll}
            className="shrink-0 rounded-lg px-2 py-1.5 text-[13.5px] font-semibold text-accent-text hover:bg-sunken"
          >
            {n === total ? "None" : "All"}
          </button>
          <div className="ml-auto flex shrink-0 items-center">
            {action("Mark done", <Check size={19} strokeWidth={2.4} />, finish)}
            {action("Move to a room", <LayoutGrid size={18} />, () => setMenu(menu === "room" ? null : "room"), { menu: "room" })}
            {action("Set priority", <Flag size={18} />, () => setMenu(menu === "priority" ? null : "priority"), {
              menu: "priority",
            })}
            {action("Who's on it", <User size={18} />, () => setMenu(menu === "who" ? null : "who"), { menu: "who" })}
            {action(
              "Delete",
              <Trash2 size={18} />,
              () => {
                removeItems(selected);
                onExit();
              },
              { danger: true },
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
