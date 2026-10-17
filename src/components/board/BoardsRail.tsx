"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useOpenBoards } from "@/lib/board-nav";
import { ROOM_PAINT } from "@/lib/rooms";
import type { Room } from "@/lib/types";
import { SectionHead } from "@/components/ui";
import { BoardCover, NewBoardCard } from "@/components/board/BoardCover";

/**
 * Boards as a row of cover cards, like the rooms' swatch cards: every board
 * (on Home and the simple list), or one room's (on its page). With none yet,
 * a single line offers to start one.
 */
export function BoardsRail({ room, title = "Boards" }: { room?: Room; title?: string }) {
  const { boards } = useStore();
  const open = useOpenBoards();
  const shown = room ? boards.filter((b) => b.room === room) : boards;

  if (shown.length === 0) {
    return (
      <button
        type="button"
        onClick={() => open({ board: "new", room: room ?? null })}
        className="flex w-full items-center gap-3 rounded-card border border-dashed border-line-strong px-4 py-3.5 text-left transition-colors hover:border-tick-ring"
      >
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-sunken text-ink-2">
          <Plus size={20} />
        </span>
        <span className="grid min-w-0">
          <span className="text-supporting font-semibold text-ink">
            {room ? `Start a board for the ${ROOM_PAINT[room].label.toLowerCase()}` : "Start a planning board"}
          </span>
          <span className="text-meta text-ink-2">Pictures, links and colours, sorted from Ideas to Decided.</span>
        </span>
      </button>
    );
  }

  return (
    <section aria-labelledby={`boards-head-${room ?? "all"}`}>
      <SectionHead id={`boards-head-${room ?? "all"}`} title={title}>
        <button
          type="button"
          onClick={() => open({})}
          className="inline-flex items-center gap-0.5 text-supporting font-semibold text-accent-text hover:underline"
        >
          All boards <ChevronRight size={16} />
        </button>
      </SectionHead>
      <div className="rail -mx-4 flex gap-2.5 overflow-x-auto px-4 pt-1 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {shown.slice(0, 7).map((b) => (
          <BoardCover key={b.id} board={b} compact onOpen={() => open({ board: b.id })} />
        ))}
        <NewBoardCard compact onClick={() => open({ board: "new", room: room ?? null })} />
      </div>
    </section>
  );
}
