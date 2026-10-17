"use client";

import { memo } from "react";
import clsx from "clsx";
import { Link2, ShoppingBag } from "lucide-react";
import { heightFor, type PieceDTO } from "@/lib/boards";
import { photoSrc, type ItemDTO, type Room } from "@/lib/types";
import { formatCost, formatGBP } from "@/lib/format";
import { ROOM_PAINT } from "@/lib/rooms";
import { RoomTag, TickButton } from "@/components/ui";

// Pieces are drawn in board units and a phone opens the board at about 0.7,
// so their type is set a size up from the app's ramp: a 22px title reads as
// the 15px body size on screen, 18px meta as 13px.

/**
 * One thing on a board, drawn at its place. It only draws: picking up,
 * moving and selecting are the board's (BoardView), which finds a piece by
 * its data-piece attribute.
 */
export const Piece = memo(function Piece({
  piece,
  item,
  boardRoom,
  selected,
  sharp,
  onToggle,
}: {
  piece: PieceDTO;
  /** The live item, for an item card. */
  item: ItemDTO | undefined;
  /** The board's room: an item card only names its room when it's another one. */
  boardRoom: Room | null;
  selected: boolean;
  /** Zoomed in far enough that the small copy of a picture would blur. */
  sharp: boolean;
  onToggle: (item: ItemDTO) => void;
}) {
  const fixedHeight = piece.kind === "PHOTO" || piece.kind === "NOTE" || piece.kind === "SWATCH";
  return (
    <div
      data-piece={piece.id}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      aria-label={describe(piece, item)}
      className="piece absolute outline-none"
      style={{
        left: piece.x,
        top: piece.y,
        width: piece.w,
        height: fixedHeight ? heightFor(piece.kind, piece.w, piece.aspect) : undefined,
        zIndex: piece.z,
      }}
    >
      <div className={clsx("piece-body h-full", selected && "piece-selected")}>
        {piece.kind === "PHOTO" && <PhotoPiece piece={piece} sharp={sharp} />}
        {piece.kind === "LINK" && <LinkPiece piece={piece} sharp={sharp} />}
        {piece.kind === "ITEM" && <ItemPiece piece={piece} item={item} boardRoom={boardRoom} sharp={sharp} onToggle={onToggle} />}
        {piece.kind === "NOTE" && <NotePiece piece={piece} />}
        {piece.kind === "SWATCH" && <SwatchPiece piece={piece} />}
      </div>
      {/* The corner it's resized by. */}
      {selected && <span data-handle="" aria-hidden="true" className="piece-handle" />}
    </div>
  );
});

function describe(piece: PieceDTO, item: ItemDTO | undefined) {
  switch (piece.kind) {
    case "PHOTO":
      return piece.title ? `Photo: ${piece.title}` : "Photo";
    case "LINK":
      return `${piece.title ?? "Link"}${piece.price != null ? `, ${formatGBP(piece.price)}` : ""}`;
    case "ITEM":
      return item ? `From the list: ${item.title}` : "No longer on the list";
    case "NOTE":
      return `Note: ${piece.text ?? ""}`;
    case "SWATCH":
      return `Colour: ${piece.title ?? piece.color}`;
  }
}

function Picture({ id, sharp, className }: { id: string; sharp: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoSrc(id, sharp ? "full" : "thumb")}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      className={clsx("block h-full w-full object-cover select-none", className)}
    />
  );
}

/** A print: the picture on a narrow surface border, caption underneath if it has one. */
function PhotoPiece({ piece, sharp }: { piece: PieceDTO; sharp: boolean }) {
  return (
    <div className="flex h-full flex-col rounded-[4px] border border-line bg-surface p-1.5">
      <div className="min-h-0 flex-1 overflow-hidden rounded-[3px] bg-sunken">
        {piece.imageId && <Picture id={piece.imageId} sharp={sharp} />}
      </div>
      {piece.title && <p className="truncate px-0.5 pt-2 text-[20px] font-medium text-ink">{piece.title}</p>}
    </div>
  );
}

function LinkPiece({ piece, sharp }: { piece: PieceDTO; sharp: boolean }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      {piece.imageId ? (
        <div className="bg-sunken" style={{ aspectRatio: piece.aspect ?? 1.25 }}>
          <Picture id={piece.imageId} sharp={sharp} />
        </div>
      ) : (
        <div className="grid h-16 place-items-center bg-sunken text-ink-3">
          <Link2 size={28} aria-hidden="true" />
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1 px-4 pt-3 pb-4">
        <p className="line-clamp-2 text-[22px] leading-snug font-semibold text-ink">{piece.title || piece.site || "Link"}</p>
        <p className="flex min-w-0 items-baseline justify-between gap-2 text-[18px]">
          <span className="min-w-0 truncate text-ink-3">{piece.site}</span>
          {piece.price != null && <span className="shrink-0 font-semibold text-ink tabular">{formatGBP(piece.price)}</span>}
        </p>
      </div>
    </div>
  );
}

/** The real thing from the list: ticking it here ticks it there. */
function ItemPiece({
  piece,
  item,
  boardRoom,
  sharp,
  onToggle,
}: {
  piece: PieceDTO;
  item: ItemDTO | undefined;
  boardRoom: Room | null;
  sharp: boolean;
  onToggle: (item: ItemDTO) => void;
}) {
  const photo = item?.photos[0];
  const imageId = photo?.id ?? piece.imageId;
  if (!item) {
    return (
      <div className="overflow-hidden rounded-card border border-dashed border-line-strong bg-surface/70">
        <div className="grid gap-0.5 px-4 py-4">
          <p className="truncate text-[22px] font-semibold text-ink-3 line-through">{piece.title ?? "Something from the list"}</p>
          <p className="text-[18px] text-ink-3 italic">No longer on the list</p>
        </div>
      </div>
    );
  }
  const done = item.status === "DONE";
  const cost = formatCost(item.actualPrice ?? item.estimatedPrice, item.actualPrice != null ? null : item.estimateMax);
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      {imageId && (
        <div className={clsx("bg-sunken", done && "opacity-60")} style={{ aspectRatio: piece.aspect ?? 1.25 }}>
          <Picture id={imageId} sharp={sharp} />
        </div>
      )}
      <div className="flex items-start gap-3 px-4 pt-3 pb-4">
        <div className="pt-0.5">
          <TickButton done={done} room={item.room} label={item.title} onToggle={() => onToggle(item)} size="lg" />
        </div>
        <div className="grid min-w-0 flex-1 gap-1">
          <p
            className={clsx(
              "line-clamp-3 text-[22px] leading-snug font-semibold",
              done ? "text-ink-3 line-through decoration-ink-3/50" : "text-ink",
            )}
          >
            {item.title}
          </p>
          {(cost || item.kind === "BUY" || item.room !== boardRoom) && (
            <p className="flex items-center gap-2 text-[18px] text-ink-2">
              {item.kind === "BUY" && <ShoppingBag size={17} strokeWidth={2} className="shrink-0 text-ink-3" aria-label="To buy" />}
              {cost && <span className="shrink-0 font-semibold text-ink tabular">{cost}</span>}
              {item.room !== boardRoom && (
                <span className="min-w-0 truncate">
                  <RoomTag room={item.room} />
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function NotePiece({ piece }: { piece: PieceDTO }) {
  return (
    <div className="h-full overflow-hidden rounded-[4px] border border-line bg-surface px-4 py-3.5">
      <p className="line-clamp-[7] text-[22px] leading-snug font-medium whitespace-pre-wrap text-ink">{piece.text}</p>
    </div>
  );
}

/** A chip cut from a paint card: the colour, then its name and number. */
function SwatchPiece({ piece }: { piece: PieceDTO }) {
  const colour = piece.color ?? "#cccccc";
  const paint = Object.values(ROOM_PAINT).find((p) => p.hex === colour);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-chip border border-line bg-surface">
      <div className="flex-1 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]" style={{ background: colour }} />
      <div className="grid gap-0.5 px-2.5 pt-2 pb-2.5 leading-tight">
        <span className="truncate text-[18px] font-semibold text-ink">{piece.title || paint?.paint || "Colour"}</span>
        <span className="text-[17px] text-ink-2 tabular">{paint ? paint.number : colour.toUpperCase()}</span>
      </div>
    </div>
  );
}
