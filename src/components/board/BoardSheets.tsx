"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Hammer, Search, ShoppingBag, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import * as api from "@/lib/api-client";
import { preparePhoto, type PreparedPhoto } from "@/lib/photo-resize";
import { readableLink, siteOf, titleFromUrl } from "@/lib/unfurl";
import { formatCost, formatGBP, normaliseLink } from "@/lib/format";
import { ROOM_PAINT } from "@/lib/rooms";
import { ROOMS, TITLE_MAX, type ItemDTO, type Kind, type Room } from "@/lib/types";
import { BOARD_NAME_MAX, normaliseColour, pieceName, type BoardDTO, type PieceDTO } from "@/lib/boards";
import { MiniSheet } from "@/components/MiniSheet";
import { Button, Chip, GrowingTextarea, MoneyInput, PaintChip, Segmented, inputClass } from "@/components/ui";

const label = "text-meta font-semibold text-ink-2";

/** Rooms as one scrolling row of chips, opening at the chosen one. */
function RoomRail({ value, onChange, none }: { value: Room | null; onChange: (room: Room | null) => void; none?: string }) {
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = railRef.current;
    const chip = rail?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (rail && chip) rail.scrollLeft += chip.getBoundingClientRect().left - rail.getBoundingClientRect().left - 20;
  }, []);
  return (
    <div ref={railRef} className="rail -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
      {none && (
        <Chip selected={value === null} onClick={() => onChange(null)} className="py-2">
          {none}
        </Chip>
      )}
      {ROOMS.map((r) => (
        <Chip key={r} selected={value === r} onClick={() => onChange(r)} className="py-2">
          <PaintChip room={r} />
          {ROOM_PAINT[r].label}
        </Chip>
      ))}
    </div>
  );
}

/** Naming a new board, or renaming one (and deleting it from here). */
export function BoardDetailsSheet({
  board,
  room: startRoom,
  leaving,
  onClose,
  onSaved,
}: {
  board?: BoardDTO;
  room?: Room | null;
  leaving: boolean;
  onClose: () => void;
  onSaved: (board: BoardDTO | null) => void;
}) {
  const { createBoard, updateBoard, removeBoard } = useStore();
  const [name, setName] = useState(board?.name ?? "");
  const [room, setRoom] = useState<Room | null>(board ? board.room : (startRoom ?? null));
  const [busy, setBusy] = useState(false);
  const ready = name.trim().length > 0;

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    const saved = board ? await updateBoard(board.id, { name: name.trim(), room }) : await createBoard(name.trim(), room);
    setBusy(false);
    if (saved) onSaved(saved);
  }

  return (
    <MiniSheet
      title={board ? "Board" : "New board"}
      leaving={leaving}
      onClose={onClose}
      footer={
        <>
          {board && (
            <Button
              variant="danger"
              onClick={() => {
                removeBoard(board);
                onSaved(null);
              }}
            >
              <Trash2 size={16} aria-hidden="true" /> Delete board
            </Button>
          )}
          <Button onClick={() => save()} disabled={!ready || busy} className="ml-auto min-w-28">
            {board ? "Save" : "Start board"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="grid gap-2">
        <label htmlFor="board-name" className={label}>
          What’s it for?
        </label>
        <input
          id="board-name"
          autoFocus={!board}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Kitchen ideas, Garden for summer"
          maxLength={BOARD_NAME_MAX}
          className={inputClass}
        />
      </form>
      <section className="grid gap-2">
        <h3 className={label}>Which room?</h3>
        <RoomRail value={room} onChange={setRoom} none="Not one room" />
        <p className="text-hint text-ink-3">The board takes the room’s paint, and what you add to the list goes in that room.</p>
      </section>
    </MiniSheet>
  );
}

type Found = { url: string; title: string; price: string; site: string; image: PreparedPhoto | null; preview: string | null };

/** A shop link: paste it, see what the page says, add it as a card with its picture. */
export function LinkSheet({
  leaving,
  onClose,
  onAdd,
}: {
  leaving: boolean;
  onClose: () => void;
  onAdd: (input: Omit<api.PieceInput, "x" | "y" | "w" | "h">, image: PreparedPhoto | null) => Promise<boolean>;
}) {
  const [raw, setRaw] = useState("");
  const [state, setState] = useState<"idle" | "reading" | "found">("idle");
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {
    if (found?.preview) URL.revokeObjectURL(found.preview);
  }, [found]);

  async function read(e?: React.FormEvent) {
    e?.preventDefault();
    const url = readableLink(raw) ?? normaliseLink(raw);
    if (!url) return setError("Paste a link from a shop");
    setError(null);
    setState("reading");
    const page = await api.unfurl(url);
    let image: PreparedPhoto | null = null;
    if (page?.image) {
      const blob = await api.fetchBoardImage(page.image);
      if (blob) image = await preparePhoto(blob).catch(() => null);
    }
    setFound({
      url: page?.url ?? url,
      title: page?.title ?? titleFromUrl(url),
      price: page?.price != null ? String(page.price) : "",
      site: page?.siteName ?? siteOf(url),
      image,
      preview: image ? URL.createObjectURL(image.thumb) : null,
    });
    setState("found");
  }

  async function add() {
    if (!found || busy) return;
    const price = Number(found.price.replace(/,/g, ""));
    setBusy(true);
    const ok = await onAdd(
      {
        kind: "LINK",
        url: found.url,
        title: found.title.trim() || null,
        price: found.price.trim() && Number.isFinite(price) ? price : null,
        site: found.site.slice(0, 80),
        aspect: found.image ? found.image.width / found.image.height : null,
      },
      found.image,
    );
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <MiniSheet
      title="Add a link"
      leaving={leaving}
      onClose={onClose}
      footer={
        state === "found" ? (
          <Button onClick={add} disabled={busy} className="ml-auto min-w-28">
            {busy ? "Adding…" : "Add to board"}
          </Button>
        ) : undefined
      }
    >
      <form onSubmit={read} className="grid gap-2">
        <label htmlFor="board-link" className={label}>
          Link from a shop or anywhere
        </label>
        <div className="flex gap-2">
          <input
            id="board-link"
            autoFocus
            type="url"
            inputMode="url"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              if (state === "found") setState("idle");
            }}
            placeholder="https://…"
            className={inputClass}
          />
          <Button type="submit" variant="secondary" disabled={!raw.trim() || state === "reading"} className="shrink-0">
            {state === "reading" ? "Reading…" : "Look"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-meta font-medium text-danger">
            {error}
          </p>
        )}
      </form>
      {state === "found" && found && (
        <div className="rise-in grid gap-3" aria-live="polite">
          <div className="flex gap-3">
            <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-control bg-sunken text-hint text-ink-3">
              {found.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={found.preview} alt="" className="h-full w-full object-cover" />
              ) : (
                "No picture"
              )}
            </div>
            <div className="grid min-w-0 flex-1 content-start gap-2">
              <input
                value={found.title}
                onChange={(e) => setFound({ ...found, title: e.target.value })}
                aria-label="Name"
                maxLength={TITLE_MAX}
                className={inputClass}
              />
              <MoneyInput label="Price" value={found.price} onChange={(price) => setFound({ ...found, price })} placeholder="Price" />
            </div>
          </div>
          <p className="text-hint text-ink-3">From {found.site}. Change the name or price if the page got it wrong.</p>
        </div>
      )}
    </MiniSheet>
  );
}

/** A sticky note, new or being rewritten. */
export function NoteSheet({
  piece,
  leaving,
  onClose,
  onSave,
}: {
  piece?: PieceDTO;
  leaving: boolean;
  onClose: () => void;
  onSave: (text: string) => Promise<boolean> | boolean;
}) {
  const [text, setText] = useState(piece?.text ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <MiniSheet
      title={piece ? "Note" : "Add a note"}
      leaving={leaving}
      onClose={onClose}
      footer={
        <Button
          onClick={async () => {
            setBusy(true);
            const ok = await onSave(text.trim());
            setBusy(false);
            if (ok) onClose();
          }}
          disabled={!text.trim() || busy}
          className="ml-auto min-w-28"
        >
          {piece ? "Save" : "Add to board"}
        </Button>
      }
    >
      <GrowingTextarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        minRows={4}
        maxLength={1000}
        aria-label="Note"
        placeholder="A thought, a measurement, a question for later…"
        className={inputClass}
      />
    </MiniSheet>
  );
}

/** A colour: one of the house's paints, or any colour, with a name. */
export function SwatchSheet({
  piece,
  start,
  leaving,
  onClose,
  onSave,
}: {
  piece?: PieceDTO;
  /** The colour a new swatch starts on: the board's own paint, if it has one. */
  start?: string | null;
  leaving: boolean;
  onClose: () => void;
  onSave: (colour: string, name: string) => Promise<boolean> | boolean;
}) {
  const paints = Object.values(ROOM_PAINT);
  const first = paints.find((p) => p.hex === start) ?? paints[0];
  const [colour, setColour] = useState(piece?.color ?? first.hex);
  const [hex, setHex] = useState(colour);
  const [name, setName] = useState(piece?.title ?? (piece ? "" : first.paint));
  const [busy, setBusy] = useState(false);

  function pick(next: string, paintName?: string) {
    // A name that was only the last paint's follows the new one.
    const wasPaintName = !name.trim() || paints.some((p) => p.paint === name);
    setColour(next);
    setHex(next);
    if (wasPaintName) setName(paintName ?? "");
  }

  return (
    <MiniSheet
      title={piece ? "Colour" : "Add a colour"}
      leaving={leaving}
      onClose={onClose}
      footer={
        <Button
          onClick={async () => {
            setBusy(true);
            const ok = await onSave(colour, name.trim());
            setBusy(false);
            if (ok) onClose();
          }}
          disabled={busy}
          className="ml-auto min-w-28"
        >
          {piece ? "Save" : "Add to board"}
        </Button>
      }
    >
      <section className="grid gap-2">
        <h3 className={label}>The house’s paints</h3>
        <div role="radiogroup" aria-label="Paint" className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {paints.map((p) => (
            <button
              key={p.hex}
              type="button"
              role="radio"
              aria-checked={colour === p.hex}
              aria-label={`${p.paint}, ${p.number}`}
              onClick={() => pick(p.hex, p.paint)}
              className="grid gap-1 text-left"
            >
              <span
                className={clsx(
                  "relative grid aspect-square place-items-center rounded-chip shadow-[inset_0_0_0_1px_var(--chip-edge)]",
                  colour === p.hex && "outline-2 outline-offset-2 outline-accent",
                )}
                style={{ background: p.hex, color: p.ink }}
              >
                {colour === p.hex && <Check size={18} strokeWidth={2.6} />}
              </span>
              <span className="truncate text-label font-semibold text-ink-2">{p.paint}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="grid gap-2">
        <h3 className={label}>Or any colour</h3>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colour}
            onChange={(e) => pick(e.target.value)}
            aria-label="Pick a colour"
            className="h-11 w-14 shrink-0 cursor-pointer rounded-control border border-line bg-surface p-1"
          />
          <input
            value={hex}
            onChange={(e) => {
              setHex(e.target.value);
              const ok = normaliseColour(e.target.value);
              if (ok) pick(ok);
            }}
            aria-label="Colour code"
            placeholder="#9db39a"
            maxLength={7}
            className={clsx(inputClass, "tabular")}
          />
        </div>
      </section>
      <section className="grid gap-2">
        <label htmlFor="swatch-name" className={label}>
          Name
        </label>
        <input
          id="swatch-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Farrow & Ball Hague Blue"
          maxLength={TITLE_MAX}
          className={inputClass}
        />
      </section>
    </MiniSheet>
  );
}

/** A photo's caption, or a link card's name and price. */
export function DetailsSheet({
  piece,
  leaving,
  onClose,
  onSave,
}: {
  piece: PieceDTO;
  leaving: boolean;
  onClose: () => void;
  onSave: (patch: { title: string | null; price?: number | null }) => void;
}) {
  const isLink = piece.kind === "LINK";
  const [title, setTitle] = useState(piece.title ?? "");
  const [price, setPrice] = useState(piece.price != null ? String(piece.price) : "");
  return (
    <MiniSheet
      title={isLink ? "Link" : "Photo"}
      leaving={leaving}
      onClose={onClose}
      footer={
        <>
          {isLink && piece.url && (
            <a
              href={piece.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-control px-3 py-2.5 text-sm font-semibold text-accent-text hover:bg-sunken"
            >
              Open {piece.site ?? "the page"}
            </a>
          )}
          <Button
            onClick={() => {
              const n = Number(price.replace(/,/g, ""));
              onSave({
                title: title.trim() || null,
                ...(isLink ? { price: price.trim() && Number.isFinite(n) ? n : null } : {}),
              });
              onClose();
            }}
            className="ml-auto min-w-28"
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <label htmlFor="piece-title" className={label}>
          {isLink ? "Name" : "What is it?"}
        </label>
        <input
          id="piece-title"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isLink ? "Name" : "e.g. The green tiles from Topps"}
          maxLength={TITLE_MAX}
          className={inputClass}
        />
      </div>
      {isLink && (
        <div className="grid gap-2">
          <span className={label}>Price</span>
          <MoneyInput label="Price" value={price} onChange={setPrice} placeholder="Price" />
        </div>
      )}
    </MiniSheet>
  );
}

/** Something already on the list, to pin to the board. */
export function ItemPickerSheet({
  board,
  leaving,
  onClose,
  onPick,
}: {
  board: BoardDTO;
  leaving: boolean;
  onClose: () => void;
  onPick: (item: ItemDTO) => void;
}) {
  const { items } = useStore();
  const [query, setQuery] = useState("");
  const onBoard = useMemo(() => new Set(board.pieces.flatMap((p) => (p.itemId ? [p.itemId] : []))), [board.pieces]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => i.status !== "DONE" && (!q || i.title.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.room === board.room) - Number(a.room === board.room));
  }, [items, query, board.room]);

  return (
    <MiniSheet title="Add from the list" leaving={leaving} onClose={onClose}>
      <div className="relative">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find something"
          aria-label="Find something on the list"
          className={clsx(inputClass, "pl-9")}
        />
      </div>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-supporting text-ink-3">
          {query.trim() ? "Nothing on the list matches that." : "Nothing on the list yet."}
        </p>
      ) : (
        <ul className="-mx-5 border-t border-line">
          {shown.map((item) => {
            const pinned = onBoard.has(item.id);
            const cost = formatCost(item.estimatedPrice, item.estimateMax);
            return (
              <li key={item.id} className="border-b border-line">
                <button
                  type="button"
                  disabled={pinned}
                  onClick={() => onPick(item)}
                  className="flex min-h-12 w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-sunken/60 disabled:opacity-55"
                >
                  <PaintChip room={item.room} />
                  <span className="min-w-0 flex-1 truncate text-body text-ink">{item.title}</span>
                  {pinned ? (
                    <span className="shrink-0 text-meta text-ink-3">On the board</span>
                  ) : (
                    cost && <span className="shrink-0 text-meta font-medium text-ink-2 tabular">{cost}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </MiniSheet>
  );
}

/** An idea made real: named, filed in a room, and on the list with its picture, price and link. */
export function ToListSheet({
  piece,
  board,
  leaving,
  onClose,
}: {
  piece: PieceDTO;
  board: BoardDTO;
  leaving: boolean;
  onClose: () => void;
}) {
  const { pieceToItem, toast } = useStore();
  const [title, setTitle] = useState(() => pieceName(piece) || (piece.kind === "SWATCH" && piece.title ? piece.title : ""));
  const [kind, setKind] = useState<Kind>(piece.kind === "NOTE" ? "TASK" : "BUY");
  const [room, setRoom] = useState<Room>(board.room ?? "WHOLE_HOUSE");
  const [busy, setBusy] = useState(false);

  async function add(e?: React.FormEvent) {
    e?.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    const item = await pieceToItem(piece, { title: title.trim(), kind, room });
    setBusy(false);
    if (item) {
      toast({ message: `Added “${item.title}” to the list` });
      onClose();
    }
  }

  return (
    <MiniSheet
      title="Add to the list"
      leaving={leaving}
      onClose={onClose}
      footer={
        <Button onClick={() => add()} disabled={!title.trim() || busy} className="ml-auto min-w-32">
          {busy ? "Adding…" : "Add to the list"}
        </Button>
      }
    >
      <form onSubmit={add} className="grid gap-2">
        <label htmlFor="to-list-title" className={label}>
          {kind === "BUY" ? "What to buy" : "What needs doing"}
        </label>
        <input
          id="to-list-title"
          autoFocus={!title}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "BUY" ? "e.g. Velvet sofa" : "e.g. Paint the kitchen"}
          maxLength={TITLE_MAX}
          className={inputClass}
        />
      </form>
      <Segmented
        label="Type"
        value={kind}
        onChange={setKind}
        options={[
          { value: "BUY", label: <><ShoppingBag size={14} strokeWidth={2.2} aria-hidden="true" /> To buy</> },
          { value: "TASK", label: <><Hammer size={14} strokeWidth={2.2} aria-hidden="true" /> Job</> },
        ]}
      />
      <section className="grid gap-2">
        <h3 className={label}>Room</h3>
        <RoomRail value={room} onChange={(r) => setRoom(r ?? "WHOLE_HOUSE")} />
      </section>
      {(piece.price != null || piece.imageId || piece.url) && (
        <p className="text-hint text-ink-3">
          Comes with its{" "}
          {[piece.imageId && "picture", piece.price != null && `price (${formatGBP(piece.price)})`, piece.url && "link"]
            .filter(Boolean)
            .join(", ")
            .replace(/, ([^,]*)$/, " and $1")}
          .
        </p>
      )}
    </MiniSheet>
  );
}
