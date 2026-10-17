"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useSheetExit } from "@/lib/useSheetDrag";
import type { Room } from "@/lib/types";
import { BoardView } from "@/components/board/BoardView";
import { BoardCover, NewBoardCard } from "@/components/board/BoardCover";
import { BoardDetailsSheet } from "@/components/board/BoardSheets";

export type BoardTarget = { board?: string | "new"; room?: Room | null };

/**
 * The boards, over whichever layout this phone shows: a full-screen dialog
 * holding either every board or one of them. Back from a board goes to the
 * boards; closing goes back to where you were.
 */
export function BoardLayer({ target, leaving, onClose }: { target: BoardTarget; leaving: boolean; onClose: () => void }) {
  const { boards } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState<string | null>(target.board && target.board !== "new" ? target.board : null);
  const [naming, setNaming] = useState<Room | null | undefined>(target.board === "new" ? (target.room ?? null) : undefined);
  const namingFor = useMemo(() => (naming === undefined ? null : { room: naming }), [naming]);
  const namingSheet = useSheetExit(namingFor);
  const board = current ? boards.find((b) => b.id === current) : undefined;
  // Opened straight onto a board: back closes rather than showing the rest.
  const direct = useRef(!!current || target.board === "new");

  // Before the sheets inside it open theirs (layout effects run first), so
  // a sheet opened with the board, like naming a new one, sits on top.
  useLayoutEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  function back() {
    if (board && !direct.current) setCurrent(null);
    else onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-label={board ? board.name : "Boards"}
      onCancel={(e) => {
        e.preventDefault();
        if (!leaving) back();
      }}
      className={clsx(
        "board-layer m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-bg p-0 text-ink",
        leaving && "board-leaving",
      )}
    >
      {board ? (
        <BoardView key={board.id} board={board} onBack={back} />
      ) : (
        <div className="flex h-dvh flex-col">
          <header className="flex items-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2 sm:px-6">
            <h1 className="flex-1 text-headline font-bold tracking-[-0.025em]">Boards</h1>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close boards"
              className="hit grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink"
            >
              <X size={21} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-[960px] px-4 pt-2 pb-10 sm:px-6">
              <p className="mb-5 max-w-[46ch] text-supporting text-ink-2">
                Pin up pictures, shop links, colours and notes, then drag what you like from Ideas to Decided. Decided things go
                on the list in one tap.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {boards.map((b) => (
                  <BoardCover
                    key={b.id}
                    board={b}
                    onOpen={() => {
                      direct.current = false;
                      setCurrent(b.id);
                    }}
                  />
                ))}
                <NewBoardCard onClick={() => setNaming(null)} label={boards.length ? "New board" : "Start a board"} />
              </div>
            </div>
          </div>
        </div>
      )}
      {namingSheet.shown && (
        <BoardDetailsSheet
          key={namingSheet.opening}
          room={namingSheet.shown.room}
          leaving={namingSheet.leaving}
          onClose={() => {
            setNaming(undefined);
            // Opened only to start one: nothing else to show.
            if (target.board === "new" && !current && direct.current) onClose();
          }}
          onSaved={(saved) => {
            setNaming(undefined);
            if (saved) {
              direct.current = target.board === "new";
              setCurrent(saved.id);
            }
          }}
        />
      )}
    </dialog>
  );
}
