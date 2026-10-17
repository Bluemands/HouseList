"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ImagePlus,
  Link2,
  ListChecks,
  ListPlus,
  LoaderCircle,
  Maximize2,
  Palette,
  Pencil,
  SquareArrowOutUpRight,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { PieceInput } from "@/lib/api-client";
import { preparePhoto, type PreparedPhoto } from "@/lib/photo-resize";
import { haptic } from "@/lib/haptics";
import { prefersReducedMotion, project, spring, velocityTracker, type Spring, type VelocityTracker } from "@/lib/motion";
import { useSheetExit } from "@/lib/useSheetDrag";
import { ROOM_PAINT } from "@/lib/rooms";
import { photoSrc, type ItemDTO } from "@/lib/types";
import { formatCost, formatGBP } from "@/lib/format";
import {
  BANDS,
  BAND_W,
  BOARD_W,
  DECIDED,
  PIECE_WIDTH,
  TOP,
  bandOf,
  boardBounds,
  clampToBoard,
  heightFor,
  moveToBand,
  pieceName,
  placeFree,
  snap,
  type Band,
  type BoardDTO,
  type PieceDTO,
} from "@/lib/boards";
import { RoomTag, Segmented } from "@/components/ui";
import { Piece } from "@/components/board/Piece";
import { DetailsSheet, ItemPickerSheet, LinkSheet, NoteSheet, SwatchSheet, ToListSheet, BoardDetailsSheet } from "@/components/board/BoardSheets";

type View = { x: number; y: number; z: number };

// Low enough for a phone to see all three bands at once.
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const LONG_PRESS_MS = 320;
// Past this, the small copy of a picture would show its pixels.
const SHARP_PX = 340;

type Sheet =
  | { kind: "link" }
  | { kind: "note"; piece?: PieceDTO }
  | { kind: "swatch"; piece?: PieceDTO }
  | { kind: "details"; piece: PieceDTO }
  | { kind: "item" }
  | { kind: "to-list"; piece: PieceDTO }
  | { kind: "board" };

type Gesture =
  | { kind: "none" }
  | { kind: "pending"; pointer: number; x0: number; y0: number; pieceId: string | null; immediate: boolean; timer: number }
  | { kind: "pan"; pointer: number; lastX: number; lastY: number; tx: VelocityTracker; ty: VelocityTracker }
  | { kind: "pinch"; dist: number; z: number; mid: { x: number; y: number }; world: { x: number; y: number } }
  | { kind: "drag"; pointer: number; pieceId: string; el: HTMLElement; grabX: number; grabY: number; at: { x: number; y: number } }
  | { kind: "resize"; pointer: number; pieceId: string; el: HTMLElement; x0: number; w0: number; w: number };

/**
 * Where a board was left on this device, so it opens there again. Kept per
 * kind of screen: a phone's view isn't a desktop's.
 */
const viewKey = (id: string, width: number) => `board-view:${id}:${width < 1024 ? "narrow" : "wide"}`;

function savedView(id: string, width: number): View | null {
  try {
    const v = JSON.parse(localStorage.getItem(viewKey(id, width)) ?? "null");
    return v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z) ? v : null;
  } catch {
    return null;
  }
}

function saveView(id: string, width: number, v: View) {
  try {
    localStorage.setItem(viewKey(id, width), JSON.stringify(v));
  } catch {
    // A private window: it opens at the start next time instead.
  }
}

/** A phone opens on Ideas with Maybe's paint at the edge; a wide screen sees all three bands. */
function firstView(width: number): View {
  if (width < 1024) {
    // Leaves a finger's width of Maybe showing at the right edge.
    const z = Math.min(1, Math.max(0.5, (width - 44) / BAND_W));
    return { x: 12, y: 0, z };
  }
  const z = Math.min(1, (width - 48) / BOARD_W);
  return { x: (width - BOARD_W * z) / 2, y: 0, z };
}

/** A band's wash: the board's paint, stronger towards Decided; plain tones on a board with no room. */
function bandWash(paint: string | null, band: number) {
  const strength = [7, 18, 32][band];
  return paint
    ? `color-mix(in srgb, ${paint} ${strength}%, var(--bg))`
    : `color-mix(in srgb, var(--ink) ${[2, 4, 7][band]}%, var(--bg))`;
}

const HINTS = [
  "Pictures, links, notes and colours: anything you like the look of.",
  "Drag ideas here while you think them over.",
  "Drop things here to put them on the list.",
];

export function BoardView({ board, onBack }: { board: BoardDTO; onBack: () => void }) {
  const { itemById, toggleDone, addPiece, updatePiece, removePiece, openItem, toast } = useStore();
  const [mode, setMode] = useState<"board" | "list">("board");
  const [picked, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [uploading, setUploading] = useState(0);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const sheetExit = useSheetExit(sheet);

  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelWidths = useRef<number[]>([0, 0, 0]);
  const view = useRef<View>({ x: 0, y: 0, z: 1 });
  const gesture = useRef<Gesture>({ kind: "none" });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const springs = useRef<Spring[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const paint = board.room ? ROOM_PAINT[board.room].hex : null;
  const pieces = board.pieces;
  const pieceById = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces]);
  // A picked piece that's gone (taken off here or on the other phone) is let go.
  const selectedPiece = picked ? pieceById.get(picked) : undefined;
  const selected = selectedPiece ? picked : null;
  // Live state for the gesture handlers, which outlive renders.
  const live = useRef({ pieces, pieceById, selected });
  useLayoutEffect(() => {
    live.current = { pieces, pieceById, selected };
  });

  const bounds = boardBounds(pieces);
  const worldHeight = bounds.height + 1200;
  const counts = BANDS.map((_, i) => pieces.filter((p) => bandOf(p) === i).length);

  const clampView = useCallback(
    (v: View): View => {
      const vp = viewportRef.current;
      if (!vp) return v;
      const w = vp.clientWidth;
      const h = vp.clientHeight;
      const width = BOARD_W * v.z;
      // A little of the ground shows past the outer bands, no more.
      const x = width + 48 < w ? (w - width) / 2 : Math.min(24, Math.max(w - width - 24, v.x));
      const y = Math.min(40, Math.max(Math.min(0, h - bounds.height * v.z - 160), v.y));
      return { ...v, x, y };
    },
    [bounds.height],
  );

  /** Draws the board where the view says: the world's transform and the band names over it. */
  const apply = useCallback(() => {
    const v = view.current;
    const world = worldRef.current;
    const vp = viewportRef.current;
    if (!world || !vp) return;
    world.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.z})`;
    // Handles and outlines stay the same size on screen at any zoom.
    world.style.setProperty("--inv", String(1 / v.z));
    const width = vp.clientWidth;
    labelRefs.current.forEach((el, i) => {
      if (!el) return;
      const left = v.x + i * BAND_W * v.z;
      const right = left + BAND_W * v.z;
      // Measured once it's showing (the dialog may open after the first draw).
      const lw = labelWidths.current[i] || (labelWidths.current[i] = el.offsetWidth);
      // The name stays in its band and on screen as the band slides by.
      const x = Math.min(Math.max(left + 12, 12), right - lw - 12);
      el.style.transform = `translateX(${x}px)`;
      // A band only peeking in at an edge keeps its name to itself.
      const showing = Math.min(right, width) - Math.max(left, 0);
      el.style.opacity = showing < lw + 24 ? "0" : "1";
    });
  }, []);

  const settleView = useCallback(() => {
    saveView(board.id, viewportRef.current?.clientWidth || window.innerWidth, view.current);
    setZoom(Math.round(view.current.z * 10) / 10);
  }, [board.id]);

  const stopSprings = () => {
    springs.current.forEach((s) => s.stop());
    springs.current = [];
  };

  /** Glides the view to another place (or jumps there, with reduced motion). */
  const glide = useCallback(
    (to: View, velocity = { x: 0, y: 0 }) => {
      stopSprings();
      const target = clampView(to);
      if (prefersReducedMotion()) {
        view.current = target;
        apply();
        settleView();
        return;
      }
      const from = { ...view.current };
      const dz = target.z - from.z;
      let done = 0;
      const finish = () => ++done === 2 && settleView();
      springs.current = [
        spring(from.x, target.x, (x) => ((view.current.x = x), apply()), { velocity: velocity.x, response: 0.4, onDone: finish }),
        spring(
          from.y,
          target.y,
          (y) => {
            view.current.y = y;
            // Zoom follows along the same curve as y.
            if (dz) view.current.z = from.z + (dz * (y - from.y)) / (target.y - from.y || 1);
            apply();
          },
          { velocity: velocity.y, response: 0.4, onDone: () => ((view.current.z = target.z), apply(), finish()) },
        ),
      ];
    },
    [apply, clampView, settleView],
  );

  // First paint: where this phone left the board, or its starting view.
  useLayoutEffect(() => {
    if (mode !== "board") return;
    const vp = viewportRef.current;
    if (!vp) return;
    labelRefs.current.forEach((el, i) => (labelWidths.current[i] = el?.offsetWidth ?? 0));
    if (view.current.z === 1 && view.current.x === 0 && view.current.y === 0) {
      // The dialog may not be showing yet (it opens a moment later), so the
      // window says how wide it will be.
      const width = vp.clientWidth || window.innerWidth;
      view.current = clampView(savedView(board.id, width) ?? firstView(width));
      setZoom(Math.round(view.current.z * 10) / 10);
    }
    apply();
  }, [mode, board.id, apply, clampView]);

  // A phone turned on its side, or a window resized: the board stays in reach.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || mode !== "board") return;
    let wide = vp.clientWidth >= 1024;
    const watch = new ResizeObserver(() => {
      // Crossing between phone and desktop widths starts afresh at that size.
      const nowWide = vp.clientWidth >= 1024;
      if (nowWide !== wide && vp.clientWidth) {
        wide = nowWide;
        view.current = savedView(board.id, vp.clientWidth) ?? firstView(vp.clientWidth);
        setZoom(Math.round(view.current.z * 10) / 10);
      }
      view.current = clampView(view.current);
      apply();
    });
    watch.observe(vp);
    return () => watch.disconnect();
  }, [mode, apply, clampView, board.id]);

  // Band names change width with their counts.
  useLayoutEffect(() => {
    labelRefs.current.forEach((el, i) => (labelWidths.current[i] = el?.offsetWidth ?? 0));
    apply();
  }, [counts.join(), apply]); // eslint-disable-line react-hooks/exhaustive-deps

  function seeAll() {
    const vp = viewportRef.current;
    if (!vp) return;
    const z = Math.max(MIN_ZOOM, Math.min(1, (vp.clientWidth - 24) / BOARD_W, (vp.clientHeight - 24) / bounds.height));
    glide({ x: (vp.clientWidth - BOARD_W * z) / 2, y: 0, z });
  }

  /** Shows a band: the whole of it on a phone, from its left edge. */
  function showBand(band: Band) {
    const vp = viewportRef.current;
    if (!vp) return;
    const v = view.current;
    const left = v.x + band * BAND_W * v.z;
    if (left >= 0 && left + BAND_W * v.z <= vp.clientWidth) return;
    glide({ ...v, x: 12 - band * BAND_W * v.z });
  }

  function pulseDecided() {
    const el = pulseRef.current;
    if (!el) return;
    el.removeAttribute("data-on");
    void el.offsetWidth;
    el.setAttribute("data-on", "");
  }

  /** Into Decided: the band swells, and putting it on the list is one tap away. */
  function decided(piece: PieceDTO) {
    pulseDecided();
    haptic(12);
    if (piece.kind === "ITEM") return;
    toast({
      message: pieceName(piece) ? `Decided on “${pieceName(piece)}”` : "Decided",
      action: { label: "Add to list", run: () => setSheet({ kind: "to-list", piece }) },
    });
  }

  function moveTo(piece: PieceDTO, band: Band) {
    const x = moveToBand(piece, band);
    const top = Math.max(0, ...live.current.pieces.map((p) => p.z));
    updatePiece(piece, { x, z: piece.z < top ? top + 1 : piece.z });
    showBand(band);
    if (band === DECIDED && bandOf(piece) !== DECIDED) decided({ ...piece, x });
  }

  // ---- Pointer gestures: pan, pinch, pick up, move, resize. ----

  function local(e: { clientX: number; clientY: number }) {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function toWorld(p: { x: number; y: number }) {
    const v = view.current;
    return { x: (p.x - v.x) / v.z, y: (p.y - v.y) / v.z };
  }

  function pieceEl(id: string) {
    return worldRef.current?.querySelector<HTMLElement>(`[data-piece="${CSS.escape(id)}"]`) ?? null;
  }

  function startDrag(pointer: number, pieceId: string, at: { x: number; y: number }) {
    const piece = live.current.pieceById.get(pieceId);
    const el = pieceEl(pieceId);
    if (!piece || !el) return;
    const w = toWorld(at);
    gesture.current = { kind: "drag", pointer, pieceId, el, grabX: w.x - piece.x, grabY: w.y - piece.y, at };
    el.classList.add("piece-lifted");
    // In the hand it rides above everything.
    el.style.zIndex = "100000";
    gridRef.current?.setAttribute("data-on", "");
    setSelected(pieceId);
  }

  function placeDragged(g: Extract<Gesture, { kind: "drag" }>) {
    const piece = live.current.pieceById.get(g.pieceId);
    if (!piece) return;
    const w = toWorld(g.at);
    const at = clampToBoard(w.x - g.grabX, w.y - g.grabY, piece.w);
    g.el.style.left = `${at.x}px`;
    g.el.style.top = `${at.y}px`;
  }

  // Near an edge while carrying something, the board slides that way.
  const edgeLoop = useRef<number | null>(null);
  function edgePan() {
    if (edgeLoop.current != null) return;
    const step = () => {
      const g = gesture.current;
      const vp = viewportRef.current;
      if (g.kind !== "drag" || !vp) {
        edgeLoop.current = null;
        return;
      }
      const edge = 48;
      const speed = (d: number) => (d < edge ? ((edge - d) / edge) * 14 : 0);
      const dx = speed(g.at.x) - speed(vp.clientWidth - g.at.x);
      const dy = speed(g.at.y - 40) - speed(vp.clientHeight - g.at.y);
      if (dx || dy) {
        view.current = clampView({ ...view.current, x: view.current.x + dx, y: view.current.y + dy });
        apply();
        placeDragged(g);
        edgeLoop.current = requestAnimationFrame(step);
      } else {
        edgeLoop.current = null;
      }
    };
    edgeLoop.current = requestAnimationFrame(step);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Controls inside pieces (an item's tick) work as themselves.
    if (target.closest("button, a, input, textarea, select")) return;
    stopSprings();
    const at = local(e);
    pointers.current.set(e.pointerId, at);
    viewportRef.current?.setPointerCapture(e.pointerId);
    const g = gesture.current;

    if (pointers.current.size === 2) {
      if (g.kind === "drag" || g.kind === "resize") return;
      if (g.kind === "pending") window.clearTimeout(g.timer);
      const [a, b] = [...pointers.current.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture.current = { kind: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y), z: view.current.z, mid, world: toWorld(mid) };
      return;
    }
    if (pointers.current.size > 2) return;

    const handle = target.closest<HTMLElement>("[data-handle]");
    const sel = live.current.selected;
    if (handle && sel) {
      const piece = live.current.pieceById.get(sel);
      const el = pieceEl(sel);
      if (piece && el) {
        gesture.current = { kind: "resize", pointer: e.pointerId, pieceId: sel, el, x0: at.x, w0: piece.w, w: piece.w };
        return;
      }
    }

    const pieceId = target.closest<HTMLElement>("[data-piece]")?.dataset.piece ?? null;
    const immediate = !!pieceId && (e.pointerType === "mouse" || pieceId === sel);
    // A finger on a piece that isn't picked: hold still a moment to pick it up, or move to pan.
    const timer =
      pieceId && !immediate
        ? window.setTimeout(() => {
            const now = gesture.current;
            if (now.kind === "pending" && now.pointer === e.pointerId) {
              haptic();
              startDrag(e.pointerId, pieceId, pointers.current.get(e.pointerId) ?? at);
            }
          }, LONG_PRESS_MS)
        : 0;
    gesture.current = { kind: "pending", pointer: e.pointerId, x0: at.x, y0: at.y, pieceId, immediate, timer };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    const at = local(e);
    pointers.current.set(e.pointerId, at);
    const g = gesture.current;

    if (g.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (g.z * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist));
      // The point between the fingers stays under them.
      view.current = clampView({ x: mid.x - g.world.x * z, y: mid.y - g.world.y * z, z });
      apply();
      return;
    }
    if (g.kind === "pending" && g.pointer === e.pointerId) {
      const moved = Math.hypot(at.x - g.x0, at.y - g.y0);
      if (moved < (e.pointerType === "mouse" ? 3 : 8)) return;
      window.clearTimeout(g.timer);
      if (g.immediate && g.pieceId) {
        startDrag(e.pointerId, g.pieceId, { x: g.x0, y: g.y0 });
      } else {
        gesture.current = {
          kind: "pan",
          pointer: e.pointerId,
          lastX: g.x0,
          lastY: g.y0,
          tx: velocityTracker(),
          ty: velocityTracker(),
        };
      }
    }
    const now = gesture.current;
    if (now.kind === "pan" && now.pointer === e.pointerId) {
      view.current = clampView({ ...view.current, x: view.current.x + at.x - now.lastX, y: view.current.y + at.y - now.lastY });
      now.lastX = at.x;
      now.lastY = at.y;
      now.tx.add(view.current.x);
      now.ty.add(view.current.y);
      apply();
    } else if (now.kind === "drag" && now.pointer === e.pointerId) {
      now.at = at;
      placeDragged(now);
      edgePan();
    } else if (now.kind === "resize" && now.pointer === e.pointerId) {
      const piece = live.current.pieceById.get(now.pieceId);
      if (!piece) return;
      const range = PIECE_WIDTH[piece.kind];
      now.w = Math.round(Math.min(range.max, Math.max(range.min, now.w0 + (at.x - now.x0) / view.current.z)));
      now.el.style.width = `${now.w}px`;
      if (piece.kind === "PHOTO" || piece.kind === "NOTE" || piece.kind === "SWATCH") {
        now.el.style.height = `${heightFor(piece.kind, now.w, piece.aspect)}px`;
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;

    if (g.kind === "pinch") {
      // One finger still down carries on as a pan.
      const [rest] = [...pointers.current.entries()];
      gesture.current = rest
        ? { kind: "pan", pointer: rest[0], lastX: rest[1].x, lastY: rest[1].y, tx: velocityTracker(), ty: velocityTracker() }
        : { kind: "none" };
      if (!rest) settleView();
      return;
    }
    if (pointers.current.size > 0 && !("pointer" in g && g.pointer === e.pointerId)) return;
    gesture.current = { kind: "none" };

    if (g.kind === "pending") {
      window.clearTimeout(g.timer);
      // A tap: picks a piece, or lets go of one.
      setSelected(g.pieceId);
    } else if (g.kind === "pan") {
      const vx = g.tx.velocity();
      const vy = g.ty.velocity();
      if (!prefersReducedMotion() && Math.hypot(vx, vy) > 200) {
        glide({ ...view.current, x: view.current.x + project(vx), y: view.current.y + project(vy) }, { x: vx, y: vy });
      } else {
        settleView();
      }
    } else if (g.kind === "drag") {
      drop(g);
    } else if (g.kind === "resize") {
      const piece = live.current.pieceById.get(g.pieceId);
      if (piece && g.w !== piece.w) {
        updatePiece(piece, { w: g.w, h: heightFor(piece.kind, g.w, piece.aspect) });
      }
    }
  }

  function drop(g: Extract<Gesture, { kind: "drag" }>) {
    g.el.classList.remove("piece-lifted");
    gridRef.current?.removeAttribute("data-on");
    const piece = live.current.pieceById.get(g.pieceId);
    if (!piece) return;
    const w = toWorld(g.at);
    const at = clampToBoard(snap(w.x - g.grabX), snap(w.y - g.grabY), piece.w);
    g.el.style.left = `${at.x}px`;
    g.el.style.top = `${at.y}px`;
    const top = Math.max(0, ...live.current.pieces.map((p) => p.z));
    const z = piece.z < top ? top + 1 : piece.z;
    g.el.style.zIndex = String(z);
    if (at.x === piece.x && at.y === piece.y && z === piece.z) return;
    updatePiece(piece, { x: at.x, y: at.y, z });
    const from = bandOf(piece);
    const to = bandOf({ x: at.x, w: piece.w });
    if (to === DECIDED && from !== DECIDED) decided({ ...piece, x: at.x, y: at.y });
  }

  // Wheel and trackpad: scroll pans, pinch (or ctrl + wheel) zooms at the pointer.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || mode !== "board") return;
    let settle = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopSprings();
      const v = view.current;
      if (e.ctrlKey || e.metaKey) {
        const at = local(e);
        const world = { x: (at.x - v.x) / v.z, y: (at.y - v.y) / v.z };
        const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z * Math.exp(-e.deltaY * 0.01)));
        view.current = clampView({ x: at.x - world.x * z, y: at.y - world.y * z, z });
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        view.current = clampView({ ...v, x: v.x - dx, y: v.y - dy });
      }
      apply();
      window.clearTimeout(settle);
      settle = window.setTimeout(settleView, 160);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      vp.removeEventListener("wheel", onWheel);
      window.clearTimeout(settle);
    };
  }, [mode, apply, clampView, settleView]);

  // Keys for a picked piece: arrows move it a cell (five with shift), Delete
  // takes it off, Escape lets go (rather than closing the board).
  useEffect(() => {
    if (!selectedPiece || mode !== "board") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, dialog dialog")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setSelected(null);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removePiece(selectedPiece);
        return;
      }
      const step = (e.shiftKey ? 5 : 1) * 20;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!d) return;
      e.preventDefault();
      const at = clampToBoard(selectedPiece.x + d[0], selectedPiece.y + d[1], selectedPiece.w);
      updatePiece(selectedPiece, at);
      const to = bandOf({ x: at.x, w: selectedPiece.w });
      if (to === DECIDED && bandOf(selectedPiece) !== DECIDED) decided({ ...selectedPiece, ...at });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- Adding. ----

  /** A spot for something new: the first free space on screen. */
  function spot(kind: PieceDTO["kind"], aspect: number | null) {
    const vp = viewportRef.current;
    const w = PIECE_WIDTH[kind].start;
    const h = heightFor(kind, w, aspect);
    const v = view.current;
    const onScreen = vp
      ? { ...toWorld({ x: 0, y: 0 }), w: vp.clientWidth / v.z, h: vp.clientHeight / v.z }
      : { x: 0, y: 0, w: BAND_W, h: 800 };
    return { ...placeFree(live.current.pieces, onScreen, w, h), w, h };
  }

  async function add(input: Omit<PieceInput, "x" | "y" | "w" | "h">, image?: PreparedPhoto | null) {
    const piece = await addPiece(board.id, { ...spot(input.kind, input.aspect ?? null), ...input }, image);
    if (piece) setSelected(piece.id);
    return !!piece;
  }

  async function addPhotos(files: FileList | null) {
    const chosen = Array.from(files ?? []);
    if (!chosen.length) return;
    setUploading((n) => n + chosen.length);
    // One at a time: a phone shrinking several big photos at once can run out of memory.
    for (const file of chosen) {
      try {
        const photo = await preparePhoto(file);
        await add({ kind: "PHOTO", aspect: photo.width / photo.height }, photo);
      } catch {
        toast({ message: "That photo couldn't be opened. Try a JPEG or PNG?", tone: "error" });
      }
      setUploading((n) => n - 1);
    }
  }

  function addItem(item: ItemDTO) {
    const photo = item.photos[0];
    const aspect = photo ? photo.width / photo.height : null;
    add({ kind: "ITEM", itemId: item.id, aspect, title: item.title });
    setSheet(null);
  }

  const onToggle = useCallback((item: ItemDTO) => toggleDone(item), [toggleDone]);

  // ---- Drawing. ----

  const dpr = typeof window === "undefined" ? 2 : window.devicePixelRatio || 1;

  return (
    <div className="flex h-dvh flex-col bg-bg text-ink">
      <header className="flex items-center gap-1 border-b border-line bg-bg px-2 pt-[max(8px,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to boards"
          className="hit grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          onClick={() => setSheet({ kind: "board" })}
          className="grid min-w-0 flex-1 rounded-control px-1.5 py-0.5 text-left hover:bg-sunken/70"
          aria-label={`${board.name}: rename or change room`}
        >
          <span className="truncate text-title font-bold tracking-[-0.01em]">{board.name}</span>
          <span className="truncate text-meta text-ink-2">
            {board.room ? <RoomTag room={board.room} /> : "Not one room"}
            <span className="text-ink-3"> · {pieces.length === 1 ? "1 thing" : `${pieces.length} things`}</span>
          </span>
        </button>
        <div className="w-[118px] shrink-0">
          <Segmented
            label="Show as"
            size="sm"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setSelected(null);
            }}
            options={[
              { value: "board", label: "Board" },
              { value: "list", label: "List" },
            ]}
          />
        </div>
        {mode === "board" && (
          <button
            type="button"
            onClick={seeAll}
            aria-label="See the whole board"
            className="hit grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <Maximize2 size={18} />
          </button>
        )}
      </header>

      {mode === "board" ? (
        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onFocus={(e) => {
            // Tabbing to a piece picks it, so the keys and the bar act on it.
            const id = (e.target as HTMLElement).dataset?.piece;
            if (id && (e.target as HTMLElement).matches(":focus-visible")) setSelected(id);
          }}
          className="relative flex-1 touch-none overflow-hidden overscroll-none select-none"
          aria-label={`${board.name}, a board in three bands: Ideas, Maybe and Decided`}
        >
          <div ref={worldRef} className="absolute top-0 left-0 origin-top-left will-change-transform" style={{ width: BOARD_W, height: worldHeight }}>
            {BANDS.map((name, i) => (
              <div
                key={name}
                aria-hidden="true"
                className={clsx("absolute top-0 h-full", i < BANDS.length - 1 && "border-r border-line")}
                style={{ left: i * BAND_W, width: BAND_W, background: bandWash(paint, i) }}
              >
                {i === DECIDED && (
                  <div
                    ref={pulseRef}
                    className="band-pulse absolute inset-0"
                    style={{ background: paint ? `color-mix(in srgb, ${paint} 30%, transparent)` : "var(--accent-soft)" }}
                  />
                )}
                {counts[i] === 0 && zoom > 0.6 && (
                  <p className="absolute inset-x-10 text-center text-[19px] leading-snug text-ink-3" style={{ top: TOP + 40 }}>
                    {HINTS[i]}
                  </p>
                )}
              </div>
            ))}
            <div ref={gridRef} aria-hidden="true" className="board-grid pointer-events-none absolute inset-0" />
            {pieces.map((p) => (
              <Piece
                key={p.id}
                piece={p}
                item={p.itemId ? itemById.get(p.itemId) : undefined}
                boardRoom={board.room}
                selected={p.id === selected}
                sharp={p.w * zoom * dpr > SHARP_PX}
                onToggle={onToggle}
              />
            ))}
          </div>

          {/* The band names, pinned to the top as the board slides under them. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-12">
            {BANDS.map((name, i) => (
              <div
                key={name}
                ref={(el) => {
                  labelRefs.current[i] = el;
                }}
                className="absolute top-2.5 left-0 inline-flex items-baseline gap-1.5 rounded-full border border-line bg-surface/95 px-3 py-1 shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
              >
                <span className={clsx("text-supporting font-bold", i === DECIDED ? "text-ink" : "text-ink-2")}>{name}</span>
                <span className="text-meta text-ink-3 tabular">{counts[i]}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ListMode board={board} onPick={(p) => setSelected(p.id)} selected={selected} onMove={moveTo} onToList={(piece) => setSheet({ kind: "to-list", piece })} onEdit={(piece) => edit(piece)} />
      )}

      {selectedPiece && mode === "board" ? (
        <SelectionBar
          piece={selectedPiece}
          item={selectedPiece.itemId ? itemById.get(selectedPiece.itemId) : undefined}
          onMove={(band) => moveTo(selectedPiece, band)}
          onToList={() => setSheet({ kind: "to-list", piece: selectedPiece })}
          onOpen={(item) => openItem(item.id)}
          onEdit={() => edit(selectedPiece)}
          onDelete={() => {
            removePiece(selectedPiece);
            setSelected(null);
          }}
          onDone={() => setSelected(null)}
        />
      ) : (
        <nav aria-label="Add to the board" className="border-t border-line bg-surface px-1 pt-1 pb-[max(6px,env(safe-area-inset-bottom))]">
          <div className="mx-auto grid max-w-[560px] grid-cols-5">
          <BarButton icon={uploading ? <LoaderCircle size={21} className="animate-spin motion-reduce:animate-none" /> : <ImagePlus size={21} />} onClick={() => fileRef.current?.click()}>
            {uploading ? `Adding ${uploading}` : "Photo"}
          </BarButton>
          <BarButton icon={<Link2 size={21} />} onClick={() => setSheet({ kind: "link" })}>
            Link
          </BarButton>
          <BarButton icon={<ListChecks size={21} />} onClick={() => setSheet({ kind: "item" })}>
            Item
          </BarButton>
          <BarButton icon={<StickyNote size={21} />} onClick={() => setSheet({ kind: "note" })}>
            Note
          </BarButton>
          <BarButton icon={<Palette size={21} />} onClick={() => setSheet({ kind: "swatch" })}>
            Colour
          </BarButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              addPhotos(e.target.files);
              e.target.value = "";
            }}
          />
          </div>
        </nav>
      )}

      {sheetExit.shown && <Fragment key={sheetExit.opening}>{renderSheet(sheetExit.shown, sheetExit.leaving)}</Fragment>}
    </div>
  );

  function edit(piece: PieceDTO) {
    if (piece.kind === "NOTE") setSheet({ kind: "note", piece });
    else if (piece.kind === "SWATCH") setSheet({ kind: "swatch", piece });
    else if (piece.kind === "PHOTO" || piece.kind === "LINK") setSheet({ kind: "details", piece });
  }

  function renderSheet(sheet: Sheet, leaving: boolean) {
    const close = () => setSheet(null);
    switch (sheet.kind) {
      case "link":
        return <LinkSheet leaving={leaving} onClose={close} onAdd={add} />;
      case "note":
        return (
          <NoteSheet
            piece={sheet.piece}
            leaving={leaving}
            onClose={close}
            onSave={(text) => {
              if (!sheet.piece) return add({ kind: "NOTE", text });
              updatePiece(sheet.piece, { text });
              return true;
            }}
          />
        );
      case "swatch":
        return (
          <SwatchSheet
            piece={sheet.piece}
            start={paint}
            leaving={leaving}
            onClose={close}
            onSave={(color, title) => {
              if (!sheet.piece) return add({ kind: "SWATCH", color, title: title || null });
              updatePiece(sheet.piece, { color, title: title || null });
              return true;
            }}
          />
        );
      case "details":
        return <DetailsSheet piece={sheet.piece} leaving={leaving} onClose={close} onSave={(patch) => updatePiece(sheet.piece, patch)} />;
      case "item":
        return <ItemPickerSheet board={board} leaving={leaving} onClose={close} onPick={addItem} />;
      case "to-list":
        return <ToListSheet piece={pieceById.get(sheet.piece.id) ?? sheet.piece} board={board} leaving={leaving} onClose={close} />;
      case "board":
        return <BoardDetailsSheet board={board} leaving={leaving} onClose={close} onSaved={(b) => (b ? close() : onBack())} />;
    }
  }
}

function BarButton({ icon, children, onClick, tone }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; tone?: "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex min-h-14 flex-col items-center justify-center gap-1 rounded-control px-1 text-label font-semibold transition-[background-color,transform] duration-150 active:scale-[0.94]",
        tone === "danger" ? "text-danger hover:bg-danger-soft" : "text-ink-2 hover:bg-sunken hover:text-ink",
      )}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="max-w-full truncate">{children}</span>
    </button>
  );
}

/** What can be done with the picked piece, at the thumb where the add bar was. */
function SelectionBar({
  piece,
  item,
  onMove,
  onToList,
  onOpen,
  onEdit,
  onDelete,
  onDone,
}: {
  piece: PieceDTO;
  item: ItemDTO | undefined;
  onMove: (band: Band) => void;
  onToList: () => void;
  onOpen: (item: ItemDTO) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const band = bandOf(piece);
  const others = ([0, 1, 2] as Band[]).filter((b) => b !== band);
  return (
    <nav aria-label="The picked piece" className="border-t border-line bg-surface px-1 pt-1 pb-[max(6px,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-[560px] [&>*]:flex-1">
      {others.map((b) => (
        <BarButton key={b} icon={b < band ? <ArrowLeft size={21} /> : <ArrowRight size={21} />} onClick={() => onMove(b)}>
          {BANDS[b]}
        </BarButton>
      ))}
      {piece.kind === "ITEM" ? (
        item && (
          <BarButton icon={<SquareArrowOutUpRight size={21} />} onClick={() => onOpen(item)}>
            Open
          </BarButton>
        )
      ) : (
        <BarButton icon={<ListPlus size={21} />} onClick={onToList}>
          To list
        </BarButton>
      )}
      {piece.kind !== "ITEM" && (
        <BarButton icon={<Pencil size={20} />} onClick={onEdit}>
          Edit
        </BarButton>
      )}
      <BarButton icon={<Trash2 size={20} />} onClick={onDelete} tone="danger">
        Remove
      </BarButton>
      <BarButton icon={<X size={21} />} onClick={onDone}>
        Done
      </BarButton>
      </div>
    </nav>
  );
}

/** The board as three plain lists: every piece reachable without dragging. */
function ListMode({
  board,
  selected,
  onPick,
  onMove,
  onToList,
  onEdit,
}: {
  board: BoardDTO;
  selected: string | null;
  onPick: (piece: PieceDTO) => void;
  onMove: (piece: PieceDTO, band: Band) => void;
  onToList: (piece: PieceDTO) => void;
  onEdit: (piece: PieceDTO) => void;
}) {
  const { itemById, removePiece, openItem } = useStore();
  const byBand = BANDS.map((_, i) => board.pieces.filter((p) => bandOf(p) === i).sort((a, b) => a.y - b.y || a.x - b.x));
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto grid max-w-[720px] gap-6 px-4 pt-4 pb-8">
        {BANDS.map((name, band) => (
          <section key={name} aria-labelledby={`band-${band}`}>
            <h2 id={`band-${band}`} className="mb-1 flex items-baseline gap-2 text-title font-bold">
              {name} <span className="text-meta font-normal text-ink-3 tabular">{byBand[band].length}</span>
            </h2>
            {byBand[band].length === 0 ? (
              <p className="border-t border-line py-3 text-supporting text-ink-3">{HINTS[band]}</p>
            ) : (
              <ul className="border-t border-line">
                {byBand[band].map((p) => {
                  const item = p.itemId ? itemById.get(p.itemId) : undefined;
                  const name = item?.title ?? pieceName(p) ?? "";
                  const imageId = item?.photos[0]?.id ?? p.imageId;
                  const price = item ? formatCost(item.estimatedPrice, item.estimateMax) : p.price != null ? formatGBP(p.price) : null;
                  const paintNo = p.kind === "SWATCH" ? Object.values(ROOM_PAINT).find((r) => r.hex === p.color)?.number : undefined;
                  return (
                    <li key={p.id} className={clsx("flex items-center gap-3 border-b border-line py-2.5", selected === p.id && "bg-accent-soft/40")}>
                      {/* The row opens what can be changed: a note's words, a colour, a caption. */}
                      <button type="button" onClick={() => (p.kind === "ITEM" ? onPick(p) : onEdit(p))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-sunken text-ink-3">
                          {imageId ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photoSrc(imageId, "thumb")} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : p.kind === "SWATCH" ? (
                            <span className="h-full w-full" style={{ background: p.color ?? undefined }} />
                          ) : p.kind === "NOTE" ? (
                            <StickyNote size={18} aria-hidden="true" />
                          ) : p.kind === "ITEM" ? (
                            <ListChecks size={18} aria-hidden="true" />
                          ) : (
                            <Link2 size={18} aria-hidden="true" />
                          )}
                        </span>
                        <span className="grid min-w-0 flex-1">
                          <span className="line-clamp-2 text-body leading-snug text-ink">
                            {name || { PHOTO: "Photo", LINK: "Link", ITEM: "No longer on the list", NOTE: "Note", SWATCH: "Colour" }[p.kind]}
                          </span>
                          <span className="flex min-w-0 gap-1.5 text-meta text-ink-3">
                            {!(item && price) && (
                              <span className="truncate">
                                {item ? "On the list" : p.kind === "LINK" ? p.site : p.kind === "SWATCH" ? (paintNo ?? p.color?.toUpperCase()) : p.addedBy}
                              </span>
                            )}
                            {price && <span className="shrink-0 font-medium text-ink-2 tabular">{price}</span>}
                          </span>
                        </span>
                      </button>
                      <span className="relative shrink-0">
                        <select
                          value={band}
                          onChange={(e) => onMove(p, Number(e.target.value) as Band)}
                          aria-label={`Band for ${name || "this"}`}
                          className="appearance-none rounded-control border border-line bg-surface py-1.5 pr-7 pl-2.5 text-meta font-medium text-ink outline-none hover:border-line-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20"
                        >
                          {BANDS.map((b, i) => (
                            <option key={b} value={i}>
                              {b}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-ink-3" />
                      </span>
                      {item ? (
                        <button type="button" onClick={() => openItem(item.id)} aria-label={`Open ${item.title}`} className="hit grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-sunken">
                          <SquareArrowOutUpRight size={17} />
                        </button>
                      ) : p.kind !== "ITEM" ? (
                        <button type="button" onClick={() => onToList(p)} aria-label={`Add ${name || "this"} to the list`} className="hit grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-sunken">
                          <ListPlus size={18} />
                        </button>
                      ) : null}
                      <button type="button" onClick={() => removePiece(p)} aria-label={`Take ${name || "this"} off the board`} className="hit grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-sunken hover:text-danger">
                        <Trash2 size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
