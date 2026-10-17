import clsx from "clsx";
import { Plus } from "lucide-react";
import { ROOM_PAINT } from "@/lib/rooms";
import { photoSrc } from "@/lib/types";
import { DECIDED, bandOf, type BoardDTO, type PieceDTO } from "@/lib/boards";

// A board's card, like a room's swatch card: its paint on top (plain when it
// isn't about one room) with a few of its pictures, colours and notes laid
// on it, then its name and how far it's got. Light on purpose: Home and the
// room pages show these without loading the board itself.

/**
 * The pieces worth showing on the cover: pictures first, then colours, then
 * notes. A swatch of the board's own paint would vanish on it, so it's left off.
 */
function coverPieces(pieces: PieceDTO[], paint: string | null) {
  const rank = (p: PieceDTO) => (p.imageId ? 0 : p.kind === "SWATCH" ? 1 : p.kind === "NOTE" ? 2 : 3);
  return [...pieces]
    .filter((p) => rank(p) < 3 && !(p.kind === "SWATCH" && p.color === paint))
    .sort((a, b) => rank(a) - rank(b) || bandOf(b) - bandOf(a) || b.z - a.z)
    .slice(0, 3);
}

export function BoardCover({ board, onOpen, compact }: { board: BoardDTO; onOpen: () => void; compact?: boolean }) {
  const paint = board.room ? ROOM_PAINT[board.room] : null;
  const tiles = coverPieces(board.pieces, paint?.hex ?? null);
  const decided = board.pieces.filter((p) => bandOf(p) === DECIDED).length;
  const count = board.pieces.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx(
        "group flex shrink-0 flex-col overflow-hidden rounded-card border border-line bg-surface text-left transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-pop",
        compact ? "w-[168px] lg:w-full" : "w-full",
      )}
    >
      <div
        className="relative flex h-[96px] items-center gap-0 overflow-hidden rounded-t-[13px] px-3"
        style={{ background: paint?.hex ?? "var(--sunken)", color: paint?.ink }}
        aria-hidden="true"
      >
        {tiles.length === 0 ? (
          <span className="text-label font-semibold tracking-[0.02em] opacity-75">Nothing pinned yet</span>
        ) : (
          tiles.map((p, i) => (
            <span
              key={p.id}
              className={clsx(
                "grid h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[4px] border-2 border-surface bg-surface shadow-[0_0_0_1px_var(--chip-edge)]",
                i > 0 && "-ml-2",
              )}
            >
              {p.imageId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoSrc(p.imageId, "thumb")} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : p.kind === "SWATCH" ? (
                <span className="h-full w-full shadow-[inset_0_0_0_1px_var(--chip-edge)]" style={{ background: p.color ?? undefined }} />
              ) : (
                <span className="line-clamp-4 bg-sunken p-1.5 text-[9px] leading-tight font-medium text-ink">{p.text}</span>
              )}
            </span>
          ))
        )}
      </div>
      <div className="grid gap-0.5 p-2.5">
        <span className="truncate text-supporting font-semibold text-ink">{board.name}</span>
        <span className="truncate text-meta text-ink-2 tabular">
          {count === 0 ? (paint ? paint.label : "Empty") : `${count} ${count === 1 ? "thing" : "things"}${decided ? ` · ${decided} decided` : ""}`}
        </span>
      </div>
    </button>
  );
}

/** The dashed card that starts a new board. */
export function NewBoardCard({ onClick, compact, label = "New board" }: { onClick: () => void; compact?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex min-h-[150px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-card border border-dashed border-line-strong text-supporting font-semibold text-ink-2 transition-colors hover:border-tick-ring hover:text-ink",
        compact ? "w-[168px] lg:w-full" : "w-full",
      )}
    >
      <Plus size={20} aria-hidden="true" />
      {label}
    </button>
  );
}
