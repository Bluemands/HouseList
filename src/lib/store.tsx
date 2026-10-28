"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as api from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";
import type { ItemDTO, SettingsDTO, StepDTO } from "@/lib/types";
import { formatDay, formatGBP, today } from "@/lib/format";
import { nextOccurrence } from "@/lib/types";
import { costToConfirm, settlePot } from "@/lib/pot";
import { ROOM_PAINT } from "@/lib/rooms";
import { haptic } from "@/lib/haptics";
import { preparePhoto, type PreparedPhoto } from "@/lib/photo-resize";
import type { BoardDTO, PieceDTO } from "@/lib/boards";
import type { Kind, Room } from "@/lib/types";
import type {
  ItemCreateInput,
  ItemUpdateInput,
  PaymentCreateInput,
  PaymentUpdateInput,
  SettingsUpdateInput,
  TradespersonInput,
  EventInput,
} from "@/lib/validation";
import { net, paidLine, type PaymentDTO } from "@/lib/payments";
import type { Meter, ReadingDTO } from "@/lib/meters";
import type { TradespersonDTO } from "@/lib/tradespeople";
import type { EventDTO } from "@/lib/events";
import type { BulkCandidate } from "@/components/BulkAddSheet";
import type { AiJobDTO, AiJobUpdate } from "@/lib/ai";

export type SheetRestore = { draft: unknown; error: string };

export type BulkRequest = { title: string; intro?: string; candidates: BulkCandidate[] };

// One shared truth for both phones. Every change shows instantly (optimistic),
// then the server's answer replaces it. The other person's changes arrive by
// polling while the tab is visible, and immediately on refocus.

export type Toast = {
  id: number;
  message: string;
  tone?: "default" | "error";
  action?: { label: string; run: () => void };
  secondary?: { label: string; run: () => void };
  /** A "what did it cost?" box under the message, for a finish that had to assume a price. */
  price?: { guess: string; placeholder: string; save: (amount: number) => void };
  /** On its way out (animating), and no longer tappable. */
  leaving?: boolean;
};

type Store = {
  items: ItemDTO[];
  /**
   * What lists show. Normally `items`; for the moment after a tick it is the
   * house as it was just before, so the ticked row keeps its place (and its
   * paint can flood) and nothing else reshuffles under the finger while the
   * pot changes. Rows look up the live item through `settling`.
   */
  listing: ItemDTO[];
  /** The settings that go with `listing`, for ordering and affordability. */
  listingSettings: SettingsDTO;
  /** Just-ticked items, by id, as they were before the tick. */
  settling: ReadonlyMap<string, ItemDTO>;
  itemById: ReadonlyMap<string, ItemDTO>;
  settings: SettingsDTO;
  me: string;
  addItem: (input: Omit<ItemCreateInput, "addedBy">) => Promise<ItemDTO | null>;
  /** Several at once; resolves to how many were added. */
  addItems: (inputs: Omit<ItemCreateInput, "addedBy">[]) => Promise<number>;
  addQuote: (itemId: string, quote: { from: string; amount: number; note?: string | null }) => Promise<ItemDTO | null>;
  updateQuote: (quoteId: string, patch: { from?: string; amount?: number; note?: string | null; chosen?: boolean }) => Promise<ItemDTO | null>;
  deleteQuote: (quoteId: string) => Promise<ItemDTO | null>;
  addComment: (itemId: string, text: string) => Promise<ItemDTO | null>;
  deleteComment: (commentId: string) => Promise<ItemDTO | null>;
  /** Shrinks a chosen photo on the phone, then adds it. */
  addPhoto: (itemId: string, file: File) => Promise<ItemDTO | null>;
  /** Gone at once, back with one tap; only deleted for good once the undo has passed. */
  deletePhoto: (item: ItemDTO, photo: ItemDTO["photos"][number]) => void;
  /** Planning boards, most recently worked on first. */
  boards: BoardDTO[];
  createBoard: (name: string, room: Room | null) => Promise<BoardDTO | null>;
  updateBoard: (id: string, patch: { name?: string; room?: Room | null }) => Promise<BoardDTO | null>;
  /** Gone at once, back with one tap. */
  removeBoard: (board: BoardDTO) => void;
  /** Resolves to the piece once it's saved (a picture has to upload first). */
  addPiece: (boardId: string, input: api.PieceInput, image?: PreparedPhoto | null) => Promise<PieceDTO | null>;
  /** Moves, resizes and edits show at once, then save. */
  updatePiece: (piece: PieceDTO, patch: api.PiecePatch) => void;
  removePiece: (piece: PieceDTO) => void;
  /** Makes an idea a real item; resolves to the item. */
  pieceToItem: (piece: PieceDTO, input: { title: string; kind: Kind; room: Room }) => Promise<ItemDTO | null>;
  /** Money owed between the two of you, open and paid. */
  payments: PaymentDTO[];
  addPayment: (input: Omit<PaymentCreateInput, "addedBy">) => Promise<PaymentDTO | null>;
  updatePayment: (payment: PaymentDTO, patch: Omit<PaymentUpdateInput, "actor">) => Promise<PaymentDTO | null>;
  /** Paid today (or not paid after all), with an undo. */
  togglePaid: (payment: PaymentDTO) => void;
  /** Gone at once, back with one tap. */
  removePayment: (payment: PaymentDTO) => void;
  /** Ticks them all off together as one settle-up on `paidOn`, with one undo. */
  settleUp: (open: PaymentDTO[], paidOn: string) => Promise<boolean>;
  /** Back to owed: a settle-up taken back, with an undo. */
  reopenPayments: (paid: PaymentDTO[]) => void;
  /** Moves a whole settle-up to the day it was really paid. */
  redateSettlement: (settlementId: string, paidOn: string) => void;
  /** Meter readings, newest first. */
  readings: ReadingDTO[];
  /** Several meters read at once, each with an optional photo; resolves to how many saved. */
  addReadings: (list: { meter: Meter; value: number; takenOn: string; photo?: File | null }[]) => Promise<number>;
  /** Gone at once, back with one tap. */
  removeReading: (reading: ReadingDTO) => void;
  /** The tradespeople book, by name. */
  tradespeople: TradespersonDTO[];
  addTradesperson: (input: TradespersonInput & { name: string }) => Promise<TradespersonDTO | null>;
  updateTradesperson: (id: string, patch: TradespersonInput) => Promise<TradespersonDTO | null>;
  /** Gone at once, back with one tap. */
  removeTradesperson: (person: TradespersonDTO) => void;
  /** What's on the calendar besides jobs: gigs, family dos, birthdays. */
  events: EventDTO[];
  addEvent: (input: EventInput & { title: string; date: string }) => Promise<EventDTO | null>;
  updateEvent: (id: string, patch: EventInput) => Promise<EventDTO | null>;
  /** Gone at once, back with one tap. */
  removeEvent: (event: EventDTO) => void;
  /** Private calendar subscription path for due dates. */
  calendarPath: string;
  /** Private path of Claude's connector (the MCP server). */
  connectorPath: string;
  /** The bearer token the AI worker uses. A secret, like the calendar path. */
  workerToken: string;
  /** Questions for Claude still to deal with (waiting, working, answered, failed). */
  jobs: AiJobDTO[];
  /** The newest of those for each item. */
  jobByItem: ReadonlyMap<string, AiJobDTO>;
  /**
   * Queue a question for Claude about an item; resolves to whether it was
   * queued. With `autofill`, the answer fills the item in instead of waiting
   * as a suggestion; with `improve`, it revises the item as the question asks.
   */
  askClaude: (itemId: string, question?: string, options?: { autofill?: boolean; improve?: boolean }) => Promise<boolean>;
  /** Take back what an improvement changed. */
  undoImprove: (job: AiJobDTO) => Promise<boolean>;
  /** Used, dismissed, sent round again (a failed one), or back (an undone dismiss). */
  updateJob: (job: AiJobDTO, status: AiJobUpdate) => Promise<boolean>;
  patchItem: (id: string, patch: ItemUpdateInput) => Promise<ItemDTO | null>;
  toggleDone: (item: ItemDTO) => void;
  /** Tick (or untick) one step, straight from a list row. */
  toggleStep: (item: ItemDTO, stepId: string) => void;
  removeItem: (item: ItemDTO) => void;
  /** Several at once, with one undo. */
  removeItems: (items: ItemDTO[]) => void;
  /** The same change to several items, with one undo. */
  bulkEdit: (items: ItemDTO[], patch: ItemUpdateInput, message: string) => void;
  saveSettings: (patch: SettingsUpdateInput) => Promise<boolean>;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  /** Keeps a toast up while someone's typing in it; letting go starts its clock again. */
  holdToast: (id: number, hold: boolean) => void;
  toasts: Toast[];
  /** `restore` reopens a sheet whose save failed, with what was typed. */
  openItem: (id: string | "new", defaults?: Partial<ItemDTO>, restore?: SheetRestore) => void;
  editing: { id: string | "new"; defaults?: Partial<ItemDTO>; restore?: SheetRestore } | null;
  closeItem: () => void;
  justAdded: string | null;
  bulk: BulkRequest | null;
  openBulk: (request: BulkRequest) => void;
  closeBulk: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore outside StoreProvider");
  return ctx;
}

const POLL_MS = 15_000;
export const UNDO_MS = 6_000;
/** Long enough to find the receipt; it doesn't go while the box is in use. */
const ASK_MS = 12_000;
/** How long a ticked row lingers in an open list (matches .row-leave). */
const SETTLE_MS = 1_000;

/** The tradespeople book's order. */
const byName = (list: TradespersonDTO[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

/** The calendar's order. */
const byDate = (list: EventDTO[]) =>
  [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

/** A step as the API takes it back. */
const stepInput = ({ id, text, done, cost, link, notes }: StepDTO) => ({ id, text, done, cost, link, notes });

/** The item as it will be after the patch, and how far the pot moves. */
function applyPatch(item: ItemDTO, patch: ItemUpdateInput, me: string, potTracked: boolean) {
  const next: ItemDTO = { ...item };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "steps" || key === "stepDone" || key === "actor" || value === undefined) continue;
    (next as Record<string, unknown>)[key] = value;
  }
  // One step ticked from a row is the whole list with that one changed.
  const { stepDone } = patch;
  const steps =
    patch.steps ??
    (stepDone ? item.steps.map((st) => stepInput(st.id === stepDone.id ? { ...st, done: stepDone.done } : st)) : undefined);
  if (next.status === "DONE" && item.status !== "DONE") {
    next.completedAt = new Date().toISOString();
    next.completedBy = me;
    if (next.actualPrice == null) next.actualPrice = next.estimatedPrice;
  }
  if (next.status !== "DONE" && item.status === "DONE") {
    next.completedAt = null;
    next.completedBy = null;
    if (patch.actualPrice === undefined) next.actualPrice = null;
  }
  // Mirror the server's pot arithmetic so the money figures move instantly.
  const pot = settlePot(item, { status: next.status, actualPrice: next.actualPrice, steps }, potTracked);
  next.potCharge = pot.itemCharge;
  if (steps) {
    next.steps = steps.map((s, i) => {
      const before = item.steps.find((b) => b.id === s.id);
      return {
        ...toStep(s, i),
        potCharge: pot.stepCharges![i],
        doneAt: s.done ? (before?.done ? before.doneAt : new Date().toISOString()) : null,
      };
    });
  }
  return { next, delta: pot.delta };
}

function toStep(s: NonNullable<ItemUpdateInput["steps"]>[number], i: number): StepDTO {
  return {
    id: s.id ?? `tmp-step-${i}-${Date.now()}`,
    text: s.text,
    done: !!s.done,
    cost: s.cost ?? null,
    link: (s.link as string | null | undefined) ?? null,
    notes: (s.notes as string | null | undefined) ?? null,
    potCharge: null,
    doneAt: null,
  };
}


export function StoreProvider({
  initialItems,
  initialSettings,
  initialJobs,
  initialBoards,
  initialPayments,
  initialReadings,
  initialTradespeople,
  initialEvents,
  me,
  calendarPath,
  connectorPath,
  workerToken,
  children,
}: {
  initialItems: ItemDTO[];
  initialSettings: SettingsDTO;
  initialJobs: AiJobDTO[];
  initialBoards: BoardDTO[];
  initialPayments: PaymentDTO[];
  initialReadings: ReadingDTO[];
  initialTradespeople: TradespersonDTO[];
  initialEvents: EventDTO[];
  me: string;
  calendarPath: string;
  connectorPath: string;
  workerToken: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState(initialItems);
  const [settings, setSettings] = useState(initialSettings);
  const [jobs, setJobs] = useState(initialJobs);
  const [boards, setBoards] = useState(initialBoards);
  const [payments, setPayments] = useState(initialPayments);
  const [readings, setReadings] = useState(initialReadings);
  const [tradespeople, setTradespeople] = useState(initialTradespeople);
  const [events, setEvents] = useState(initialEvents);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editing, setEditing] = useState<Store["editing"]>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [bulk, setBulk] = useState<BulkRequest | null>(null);
  const [settle, setSettle] = useState<{
    ids: ReadonlyMap<string, ItemDTO>;
    items: ItemDTO[];
    settings: SettingsDTO;
  } | null>(null);
  const unsettle = useCallback(
    (id: string) =>
      setSettle((s) => {
        if (!s?.ids.has(id)) return s;
        const ids = new Map(s.ids);
        ids.delete(id);
        return ids.size ? { ...s, ids } : null;
      }),
    [],
  );

  // While anything is in flight (or waiting out its undo window), a poll
  // would overwrite the optimistic state with stale server state.
  const inFlight = useRef(0);
  const pendingDeletes = useRef(new Map<string, number>());
  // Changes to one item go to the server strictly in order — otherwise a
  // quick tick-then-undo can arrive reversed and leave the pot wrong.
  const itemQueues = useRef(new Map<string, Promise<unknown>>());
  // Items still being created, by their temporary id: a change made in that
  // moment waits for the real id instead of being dropped.
  const creating = useRef(new Map<string, Promise<ItemDTO | null>>());
  const patchItemRef = useRef<Store["patchItem"] | null>(null);
  const lastMutation = useRef(0);
  const itemsRef = useRef(items);
  const settingsRef = useRef(settings);
  useLayoutEffect(() => {
    itemsRef.current = items;
    settingsRef.current = settings;
  }, [items, settings]);

  const toastSeq = useRef(0);
  // A toast slides away rather than vanishing, then leaves the list.
  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 160);
  }, []);
  const heldToasts = useRef(new Set<number>());
  const dismissLater = useCallback(
    (id: number, ms: number) => window.setTimeout(() => !heldToasts.current.has(id) && dismissToast(id), ms),
    [dismissToast],
  );
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++toastSeq.current;
      setToasts((list) => [...list.slice(-2), { ...t, id }]);
      dismissLater(id, t.price ? ASK_MS : UNDO_MS);
    },
    [dismissLater],
  );
  const holdToast = useCallback<Store["holdToast"]>(
    (id, hold) => {
      if (hold) return void heldToasts.current.add(id);
      heldToasts.current.delete(id);
      dismissLater(id, UNDO_MS);
    },
    [dismissLater],
  );

  const fail = useCallback(
    (err: unknown) => toast({ message: err instanceof ApiError ? err.message : "That didn't save — try again", tone: "error" }),
    [toast],
  );

  async function track<T>(work: () => Promise<T>): Promise<T> {
    inFlight.current += 1;
    lastMutation.current = Date.now();
    try {
      return await work();
    } finally {
      inFlight.current -= 1;
      lastMutation.current = Date.now();
    }
  }

  const refresh = useCallback(async () => {
    if (inFlight.current > 0 || pendingDeletes.current.size > 0) return;
    if (Date.now() - lastMutation.current < 1500) return;
    const seen = lastMutation.current;
    try {
      const state = await api.fetchState();
      // A change made (and maybe already saved) while this was on its way
      // isn't in it: showing it would undo that change on screen.
      if (inFlight.current > 0 || pendingDeletes.current.size > 0 || lastMutation.current !== seen) return;
      setItems(state.items);
      setSettings(state.settings);
      setJobs(state.jobs);
      setBoards(state.boards);
      setPayments(state.payments);
      setReadings(state.readings);
      setTradespeople(state.tradespeople);
      setEvents(state.events);
    } catch {
      // Background sync is best-effort; keep what's on screen.
    }
  }, []);

  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && refresh();
    const timer = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const adjustPot = useCallback((delta: number) => {
    if (delta) setSettings((s) => ({ ...s, budgetAvailable: s.budgetAvailable + delta }));
  }, []);

  const addItem = useCallback<Store["addItem"]>(
    async (input) => {
      const tempId = `tmp-${Date.now()}`;
      const now = new Date().toISOString();
      const optimistic: ItemDTO = {
        id: tempId,
        title: input.title,
        kind: input.kind ?? "TASK",
        room: input.room ?? "WHOLE_HOUSE",
        priority: input.priority ?? "WOULD_LIKE",
        status: input.status ?? "TODO",
        estimatedPrice: input.estimatedPrice ?? null,
        estimateMax: input.estimateMax ?? null,
        isQuote: input.isQuote ?? false,
        actualPrice: input.actualPrice ?? null,
        assignee: (input.assignee as string | null | undefined) ?? null,
        dueDate: input.dueDate ?? null,
        warrantyUntil: input.warrantyUntil ?? null,
        project: (input.project as string | null | undefined) ?? null,
        repeat: input.repeat ?? null,
        spawnedFromId: null,
        pinned: input.pinned ?? false,
        quotes: [],
        comments: [],
        photos: [],
        links: input.links ?? [],
        potCharge: null,
        notes: (input.notes as string | null | undefined) ?? null,
        addedBy: me,
        completedAt: null,
        completedBy: null,
        createdAt: now,
        updatedAt: now,
        steps: (input.steps ?? []).map(toStep),
      };
      setItems((list) => [optimistic, ...list]);
      setJustAdded(tempId);
      const request = track(() => api.createItem({ ...input, addedBy: me }));
      creating.current.set(tempId, request.catch(() => null));
      try {
        const created = await request;
        setItems((list) => list.map((i) => (i.id === tempId ? created : i)));
        // A change queued against the temporary id runs before the next
        // render; it must already find the real item.
        itemsRef.current = itemsRef.current.map((i) => (i.id === tempId ? created : i));
        setJustAdded(created.id);
        // What logging it took from the pot (it may have arrived already ticked).
        adjustPot(-((created.potCharge ?? 0) + created.steps.reduce((sum, s) => sum + (s.potCharge ?? 0), 0)));
        if (!settings.members.includes(me)) setSettings((s) => ({ ...s, members: [...s.members, me] }));
        return created;
      } catch (err) {
        setItems((list) => list.filter((i) => i.id !== tempId));
        fail(err);
        return null;
      } finally {
        window.setTimeout(() => creating.current.delete(tempId), UNDO_MS * 2);
      }
    },
    [me, fail, adjustPot, settings.members],
  );

  const patchItem = useCallback<Store["patchItem"]>(
    async (id, patch) => {
      if (id.startsWith("tmp-")) {
        const created = await creating.current.get(id);
        return created ? patchItemRef.current!(created.id, patch) : null;
      }
      const before = itemsRef.current.find((i) => i.id === id);
      if (!before) return null;
      const { next: optimistic, delta: localDelta } = applyPatch(before, patch, me, settingsRef.current.potTracked);
      setItems((list) => list.map((i) => (i.id === id ? optimistic : i)));
      adjustPot(localDelta);
      try {
        const previous = itemQueues.current.get(id) ?? Promise.resolve();
        const request = previous.catch(() => {}).then(() => api.updateItem(id, { ...patch, actor: me }));
        itemQueues.current.set(id, request);
        const { item, potDelta, spawned, removedIds } = await track(() => request);
        if (itemQueues.current.get(id) === request) itemQueues.current.delete(id);
        setItems((list) => {
          const next = list.map((i) => (i.id === id ? item : i)).filter((i) => !removedIds.includes(i.id));
          return spawned && !next.some((i) => i.id === spawned.id) ? [spawned, ...next] : next;
        });
        adjustPot(potDelta - localDelta);
        return item;
      } catch (err) {
        setItems((list) => list.map((i) => (i.id === id ? before : i)));
        adjustPot(-localDelta);
        fail(err);
        return null;
      }
    },
    [me, fail, adjustPot],
  );

  useLayoutEffect(() => {
    patchItemRef.current = patchItem;
  });

  const toggleDone = useCallback<Store["toggleDone"]>(
    (item) => {
      const completing = item.status !== "DONE";
      const previous = { status: item.status, actualPrice: item.actualPrice };
      if (completing) {
        // Snapshot before the optimistic patch lands (refs still hold "before").
        const before = { items: itemsRef.current, settings: settingsRef.current };
        setSettle((s) => ({ ...(s ?? before), ids: new Map(s?.ids).set(item.id, item) }));
        window.setTimeout(() => unsettle(item.id), SETTLE_MS);
        haptic(10);
      }
      patchItem(item.id, { status: completing ? "DONE" : "TODO" });
      if (!completing) return unsettle(item.id);
      const cost = item.actualPrice ?? item.estimatedPrice;
      // A range was only a guess: it's charged at the bottom figure for now,
      // and the toast asks what it really came to. Ignoring it keeps the guess.
      const ask = costToConfirm(item);
      let message =
        cost && settingsRef.current.potTracked ? `${item.title} — ${formatGBP(cost)} out of the pot` : `Done: ${item.title}`;
      if (item.repeat) message += `. Next one due ${formatDay(nextOccurrence(today(), item.repeat))}`;
      // The last open thing in a room that had a few: worth a moment.
      const roomItems = itemsRef.current.filter((i) => i.room === item.room);
      const stillOpen = roomItems.filter((i) => i.id !== item.id && i.status !== "DONE").length;
      if (stillOpen === 0 && roomItems.length >= 3 && !item.repeat) {
        message = `That's everything in the ${ROOM_PAINT[item.room].label.toLowerCase()} done. Lovely.`;
      }
      toast({
        message,
        action: {
          label: "Undo",
          run: () => {
            unsettle(item.id);
            patchItem(item.id, previous);
          },
        },
        secondary: cost && !ask ? { label: "Edit price", run: () => setEditing({ id: item.id }) } : undefined,
        price: ask
          ? {
              guess: ask.min != null ? `${formatGBP(ask.min)}–${formatGBP(ask.max)}` : `up to ${formatGBP(ask.max)}`,
              placeholder: String(ask.min ?? ask.max),
              save: (amount) => {
                patchItem(item.id, { actualPrice: amount });
                toast({
                  message: settingsRef.current.potTracked
                    ? `${item.title} — ${formatGBP(amount)} out of the pot`
                    : `${item.title} cost ${formatGBP(amount)}`,
                  // Back to the guess finishing assumed.
                  action: { label: "Undo", run: () => patchItem(item.id, { actualPrice: item.estimatedPrice }) },
                });
              },
            }
          : undefined,
      });
    },
    [patchItem, toast, unsettle],
  );

  const toggleStep = useCallback<Store["toggleStep"]>(
    (item, stepId) => {
      const step = item.steps.find((s) => s.id === stepId);
      if (!step) return;
      patchItem(item.id, { stepDone: { id: stepId, done: !step.done } });
      if (step.done) return;
      haptic(8);
      const paid = step.cost != null && step.cost > 0 && settingsRef.current.potTracked;
      // The last step done: offer to finish the whole thing in the same breath.
      const last = item.status !== "DONE" && item.steps.every((s) => s.id === stepId || s.done);
      toast({
        message: paid ? `${step.text} — ${formatGBP(step.cost!)} out of the pot` : `Done: ${step.text}`,
        action: { label: "Undo", run: () => patchItem(item.id, { stepDone: { id: stepId, done: false } }) },
        secondary: last
          ? {
              label: item.kind === "BUY" ? "Mark bought" : "Finish job",
              run: () => toggleDone(itemsRef.current.find((i) => i.id === item.id) ?? item),
            }
          : undefined,
      });
    },
    [patchItem, toast, toggleDone],
  );

  // Quotes and updates have their own endpoints (so two people adding at
  // once never overwrite each other); each answers with the whole item.
  const itemAction = useCallback(
    async (work: () => Promise<ItemDTO>) => {
      try {
        const item = await track(work);
        setItems((list) => list.map((i) => (i.id === item.id ? item : i)));
        return item;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [fail],
  );
  const addQuote = useCallback<Store["addQuote"]>(
    (itemId, quote) => itemAction(() => api.addQuote(itemId, { ...quote, addedBy: me })),
    [itemAction, me],
  );
  const updateQuote = useCallback<Store["updateQuote"]>((id, patch) => itemAction(() => api.updateQuote(id, patch)), [itemAction]);
  const deleteQuote = useCallback<Store["deleteQuote"]>((id) => itemAction(() => api.deleteQuote(id)), [itemAction]);
  const addComment = useCallback<Store["addComment"]>(
    (itemId, text) => itemAction(() => api.addComment(itemId, text, me)),
    [itemAction, me],
  );
  const deleteComment = useCallback<Store["deleteComment"]>((id) => itemAction(() => api.deleteComment(id)), [itemAction]);

  const addPhoto = useCallback<Store["addPhoto"]>(
    async (itemId, file) => {
      let photo: Awaited<ReturnType<typeof preparePhoto>>;
      try {
        photo = await preparePhoto(file);
      } catch {
        toast({ message: "That photo couldn't be opened. Try a JPEG or PNG?", tone: "error" });
        return null;
      }
      return itemAction(() => api.addPhoto(itemId, photo, me));
    },
    [itemAction, me, toast],
  );

  const deletePhoto = useCallback<Store["deletePhoto"]>(
    (item, photo) => {
      const key = `photo:${photo.id}`;
      setItems((list) =>
        list.map((i) => (i.id === item.id ? { ...i, photos: i.photos.filter((p) => p.id !== photo.id) } : i)),
      );
      const timer = window.setTimeout(async () => {
        pendingDeletes.current.delete(key);
        try {
          const updated = await track(() => api.deletePhoto(photo.id));
          // No item back means it had already gone (the other phone deleted it too).
          if (updated) setItems((list) => list.map((i) => (i.id === updated.id ? updated : i)));
        } catch (err) {
          fail(err);
        }
      }, UNDO_MS);
      pendingDeletes.current.set(key, timer);
      toast({
        message: "Removed the photo",
        action: {
          label: "Undo",
          run: () => {
            window.clearTimeout(timer);
            pendingDeletes.current.delete(key);
            setItems((list) =>
              list.map((i) =>
                i.id === item.id && !i.photos.some((p) => p.id === photo.id)
                  ? { ...i, photos: [...i.photos, photo].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }
                  : i,
              ),
            );
          },
        },
      });
    },
    [toast, fail],
  );

  // Boards: one piece changed in place, wherever it is.
  const setPiece = useCallback((piece: PieceDTO) => {
    setBoards((list) =>
      list.map((b) => (b.id === piece.boardId ? { ...b, pieces: b.pieces.map((p) => (p.id === piece.id ? piece : p)) } : b)),
    );
  }, []);

  const createBoard = useCallback<Store["createBoard"]>(
    async (name, room) => {
      try {
        const board = await track(() => api.createBoard({ name, room, createdBy: me }));
        setBoards((list) => [board, ...list]);
        return board;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [me, fail],
  );

  const updateBoard = useCallback<Store["updateBoard"]>(
    async (id, patch) => {
      setBoards((list) => list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
      try {
        const board = await track(() => api.updateBoard(id, patch));
        setBoards((list) => list.map((b) => (b.id === id ? board : b)));
        return board;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [fail],
  );

  const removeBoard = useCallback<Store["removeBoard"]>(
    (board) => {
      const key = `board:${board.id}`;
      setBoards((list) => list.filter((b) => b.id !== board.id));
      const timer = window.setTimeout(async () => {
        pendingDeletes.current.delete(key);
        try {
          await track(() => api.deleteBoard(board.id));
        } catch (err) {
          setBoards((list) => [board, ...list]);
          fail(err);
        }
      }, UNDO_MS);
      pendingDeletes.current.set(key, timer);
      toast({
        message: `Deleted the board “${board.name}”`,
        action: {
          label: "Undo",
          run: () => {
            window.clearTimeout(timer);
            pendingDeletes.current.delete(key);
            setBoards((list) => (list.some((b) => b.id === board.id) ? list : [board, ...list]));
          },
        },
      });
    },
    [toast, fail],
  );

  const addPiece = useCallback<Store["addPiece"]>(
    async (boardId, input, image) => {
      try {
        const piece = await track(() => api.addPiece(boardId, { ...input, addedBy: me }, image));
        setBoards((list) => list.map((b) => (b.id === boardId ? { ...b, pieces: [...b.pieces, piece] } : b)));
        return piece;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [me, fail],
  );

  const updatePiece = useCallback<Store["updatePiece"]>(
    (piece, patch) => {
      setPiece({ ...piece, ...patch });
      track(() => api.updatePiece(piece.id, patch)).then(setPiece, (err) => {
        // Put back what the server has, rather than leave a move that didn't save.
        setPiece(piece);
        fail(err);
      });
    },
    [setPiece, fail],
  );

  const removePiece = useCallback<Store["removePiece"]>(
    (piece) => {
      const key = `piece:${piece.id}`;
      const drop = (list: BoardDTO[]) =>
        list.map((b) => (b.id === piece.boardId ? { ...b, pieces: b.pieces.filter((p) => p.id !== piece.id) } : b));
      setBoards(drop);
      const timer = window.setTimeout(async () => {
        pendingDeletes.current.delete(key);
        try {
          await track(() => api.deletePiece(piece.id));
        } catch (err) {
          fail(err);
        }
      }, UNDO_MS);
      pendingDeletes.current.set(key, timer);
      toast({
        message: "Took it off the board",
        action: {
          label: "Undo",
          run: () => {
            window.clearTimeout(timer);
            pendingDeletes.current.delete(key);
            setBoards((list) =>
              list.map((b) =>
                b.id === piece.boardId && !b.pieces.some((p) => p.id === piece.id) ? { ...b, pieces: [...b.pieces, piece] } : b,
              ),
            );
          },
        },
      });
    },
    [toast, fail],
  );

  const pieceToItem = useCallback<Store["pieceToItem"]>(
    async (piece, input) => {
      try {
        const { piece: updated, item } = await track(() => api.pieceToItem(piece.id, { ...input, addedBy: me }));
        setPiece(updated);
        setItems((list) => [item, ...list.filter((i) => i.id !== item.id)]);
        return item;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [me, setPiece, fail],
  );

  // Payments: each answer from the server replaces those payments in place.
  const mergePayments = useCallback((saved: PaymentDTO[]) => {
    const byId = new Map(saved.map((p) => [p.id, p]));
    setPayments((list) => list.map((p) => byId.get(p.id) ?? p));
  }, []);

  const addPayment = useCallback<Store["addPayment"]>(
    async (input) => {
      try {
        const payment = await track(() => api.createPayment({ ...input, addedBy: me }));
        setPayments((list) => [payment, ...list]);
        toast({
          message: `Logged “${payment.description}”`,
          action: {
            label: "Undo",
            run: () => {
              setPayments((list) => list.filter((p) => p.id !== payment.id));
              track(() => api.deletePayment(payment.id)).catch((err) => {
                setPayments((list) => [payment, ...list]);
                fail(err);
              });
            },
          },
        });
        return payment;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [me, toast, fail],
  );

  const updatePayment = useCallback<Store["updatePayment"]>(
    async (payment, patch) => {
      // Mirrors the server: a new paid date is a payment of its own, out of any settle-up.
      const next: PaymentDTO = { ...payment };
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) (next as Record<string, unknown>)[key] = value;
      }
      if (patch.paidOn !== undefined && patch.paidOn !== payment.paidOn) {
        next.paidBy = patch.paidOn === null ? null : (payment.paidBy ?? me);
        next.settlementId = null;
      }
      setPayments((list) => list.map((p) => (p.id === payment.id ? next : p)));
      try {
        const saved = await track(() => api.updatePayment(payment.id, { ...patch, actor: me }));
        mergePayments([saved]);
        return saved;
      } catch (err) {
        mergePayments([payment]);
        fail(err);
        return null;
      }
    },
    [me, mergePayments, fail],
  );

  const togglePaid = useCallback<Store["togglePaid"]>(
    (payment) => {
      if (payment.paidOn) return void updatePayment(payment, { paidOn: null });
      haptic(10);
      updatePayment(payment, { paidOn: today() });
      toast({
        message: `Paid: ${payment.description}`,
        action: { label: "Undo", run: () => updatePayment(payment, { paidOn: null }) },
      });
    },
    [updatePayment, toast],
  );

  const removePayment = useCallback<Store["removePayment"]>(
    (payment) => {
      const key = `payment:${payment.id}`;
      setPayments((list) => list.filter((p) => p.id !== payment.id));
      const timer = window.setTimeout(async () => {
        pendingDeletes.current.delete(key);
        try {
          await track(() => api.deletePayment(payment.id));
        } catch (err) {
          setPayments((list) => [payment, ...list]);
          fail(err);
        }
      }, UNDO_MS);
      pendingDeletes.current.set(key, timer);
      toast({
        message: `Deleted “${payment.description}”`,
        action: {
          label: "Undo",
          run: () => {
            window.clearTimeout(timer);
            pendingDeletes.current.delete(key);
            setPayments((list) => (list.some((p) => p.id === payment.id) ? list : [payment, ...list]));
          },
        },
      });
    },
    [toast, fail],
  );

  // A settle-up's undo reopens it, and reopening's undo settles again.
  const reopenRef = useRef<((paid: PaymentDTO[], quiet?: boolean) => Promise<void>) | null>(null);

  const settleUp = useCallback<Store["settleUp"]>(
    async (open, paidOn) => {
      const ids = new Set(open.map((p) => p.id));
      setPayments((list) =>
        list.map((p) => (ids.has(p.id) && !p.paidOn ? { ...p, paidOn, paidBy: me, settlementId: "settling" } : p)),
      );
      haptic(10);
      try {
        const { payments: saved, settlementId } = await track(() => api.settlePayments([...ids], paidOn, me));
        mergePayments(saved);
        const settled = saved.filter((p) => p.settlementId === settlementId);
        const n = net(settled);
        toast({
          message: n.from && n.to ? `Settled up: ${paidLine(n.from, n.to, me)} ${formatGBP(n.amount)}` : "Settled up: all square",
          action: { label: "Undo", run: () => reopenRef.current?.(settled, true) },
        });
        return true;
      } catch (err) {
        mergePayments(open);
        fail(err);
        return false;
      }
    },
    [me, mergePayments, toast, fail],
  );

  const reopen = useCallback(
    async (paid: PaymentDTO[], quiet = false) => {
      const ids = new Set(paid.map((p) => p.id));
      setPayments((list) => list.map((p) => (ids.has(p.id) ? { ...p, paidOn: null, paidBy: null, settlementId: null } : p)));
      try {
        const { payments: saved } = await track(() => api.settlePayments([...ids], null, me));
        mergePayments(saved);
        if (quiet) return;
        const paidOn = paid[0]?.paidOn;
        toast({
          message: `Back to owed: ${paid.length} ${paid.length === 1 ? "payment" : "payments"}`,
          action: paidOn ? { label: "Undo", run: () => settleUp(saved, paidOn) } : undefined,
        });
      } catch (err) {
        mergePayments(paid);
        fail(err);
      }
    },
    [me, mergePayments, toast, fail, settleUp],
  );
  useLayoutEffect(() => {
    reopenRef.current = reopen;
  });
  const reopenPayments = useCallback<Store["reopenPayments"]>((paid) => void reopen(paid), [reopen]);

  const redateSettlement = useCallback<Store["redateSettlement"]>(
    (settlementId, paidOn) => {
      const before = payments.filter((p) => p.settlementId === settlementId);
      setPayments((list) => list.map((p) => (p.settlementId === settlementId ? { ...p, paidOn } : p)));
      track(() => api.redateSettlement(settlementId, paidOn)).then(mergePayments, (err) => {
        mergePayments(before);
        fail(err);
      });
    },
    [payments, mergePayments, fail],
  );

  const addReadings = useCallback<Store["addReadings"]>(
    async (list) => {
      let saved = 0;
      for (const { photo, ...reading } of list) {
        let prepared: PreparedPhoto | null = null;
        if (photo) {
          try {
            prepared = await preparePhoto(photo);
          } catch {
            toast({ message: "That photo couldn't be opened, so the reading went in without it", tone: "error" });
          }
        }
        try {
          const created = await track(() => api.addReading({ ...reading, takenBy: me }, prepared));
          setReadings((all) => [created, ...all]);
          saved += 1;
        } catch (err) {
          fail(err);
        }
      }
      return saved;
    },
    [me, toast, fail],
  );

  const removeReading = useCallback<Store["removeReading"]>(
    (reading) => {
      const key = `reading:${reading.id}`;
      setReadings((all) => all.filter((r) => r.id !== reading.id));
      const timer = window.setTimeout(async () => {
        pendingDeletes.current.delete(key);
        try {
          await track(() => api.deleteReading(reading.id));
        } catch (err) {
          setReadings((all) => [reading, ...all]);
          fail(err);
        }
      }, UNDO_MS);
      pendingDeletes.current.set(key, timer);
      toast({
        message: "Deleted the reading",
        action: {
          label: "Undo",
          run: () => {
            window.clearTimeout(timer);
            pendingDeletes.current.delete(key);
            setReadings((all) => (all.some((r) => r.id === reading.id) ? all : [reading, ...all]));
          },
        },
      });
    },
    [toast, fail],
  );

  const addTradesperson = useCallback<Store["addTradesperson"]>(
    async (input) => {
      try {
        const person = await track(() => api.createTradesperson({ ...input, addedBy: me }));
        setTradespeople((list) => byName([...list, person]));
        return person;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [me, fail],
  );

  const updateTradesperson = useCallback<Store["updateTradesperson"]>(
    async (id, patch) => {
      try {
        const person = await track(() => api.updateTradesperson(id, patch));
        setTradespeople((list) => byName(list.map((p) => (p.id === id ? person : p))));
        return person;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [fail],
  );

  const removeTradesperson = useCallback<Store["removeTradesperson"]>(
    (person) => {
      const key = `tradesperson:${person.id}`;
      setTradespeople((list) => list.filter((p) => p.id !== person.id));
      const timer = window.setTimeout(async () => {
        pendingDeletes.current.delete(key);
        try {
          await track(() => api.deleteTradesperson(person.id));
        } catch (err) {
          setTradespeople((list) => byName([...list, person]));
          fail(err);
        }
      }, UNDO_MS);
      pendingDeletes.current.set(key, timer);
      toast({
        message: `Took ${person.name} out of the book`,
        action: {
          label: "Undo",
          run: () => {
            window.clearTimeout(timer);
            pendingDeletes.current.delete(key);
            setTradespeople((list) => (list.some((p) => p.id === person.id) ? list : byName([...list, person])));
          },
        },
      });
    },
    [toast, fail],
  );

  const addEvent = useCallback<Store["addEvent"]>(
    async (input) => {
      try {
        const event = await track(() => api.createEvent({ ...input, addedBy: me }));
        setEvents((list) => byDate([...list, event]));
        return event;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [me, fail],
  );

  const updateEvent = useCallback<Store["updateEvent"]>(
    async (id, patch) => {
      try {
        const event = await track(() => api.updateEvent(id, patch));
        setEvents((list) => byDate(list.map((e) => (e.id === id ? event : e))));
        return event;
      } catch (err) {
        fail(err);
        return null;
      }
    },
    [fail],
  );

  const removeEvent = useCallback<Store["removeEvent"]>(
    (event) => {
      const key = `event:${event.id}`;
      setEvents((list) => list.filter((e) => e.id !== event.id));
      const timer = window.setTimeout(async () => {
        pendingDeletes.current.delete(key);
        try {
          await track(() => api.deleteEvent(event.id));
        } catch (err) {
          setEvents((list) => byDate([...list, event]));
          fail(err);
        }
      }, UNDO_MS);
      pendingDeletes.current.set(key, timer);
      toast({
        message: `Took ${event.title} off the calendar`,
        action: {
          label: "Undo",
          run: () => {
            window.clearTimeout(timer);
            pendingDeletes.current.delete(key);
            setEvents((list) => (list.some((e) => e.id === event.id) ? list : byDate([...list, event])));
          },
        },
      });
    },
    [toast, fail],
  );

  const addItems = useCallback<Store["addItems"]>(
    async (inputs) => {
      try {
        const created = await track(() => api.createItems(inputs, me));
        setItems((list) => [...created, ...list]);
        if (created[0]) setJustAdded(created[0].id);
        if (!settings.members.includes(me)) setSettings((s) => ({ ...s, members: [...s.members, me] }));
        return created.length;
      } catch (err) {
        fail(err);
        return 0;
      }
    },
    [me, fail, settings.members],
  );

  const removeItems = useCallback<Store["removeItems"]>(
    (gone) => {
      if (!gone.length) return;
      const ids = new Set(gone.map((i) => i.id));
      setItems((list) => list.filter((i) => !ids.has(i.id)));
      // The delete only happens once the undo window closes.
      const timer = window.setTimeout(async () => {
        for (const item of gone) {
          pendingDeletes.current.delete(item.id);
          try {
            const id = item.id.startsWith("tmp-") ? (await creating.current.get(item.id))?.id : item.id;
            if (id) await track(() => api.deleteItem(id));
          } catch (err) {
            setItems((list) => [item, ...list]);
            fail(err);
          }
        }
      }, UNDO_MS);
      for (const item of gone) pendingDeletes.current.set(item.id, timer);
      toast({
        message: gone.length === 1 ? `Deleted “${gone[0].title}”` : `Deleted ${gone.length} things`,
        action: {
          label: "Undo",
          run: () => {
            window.clearTimeout(timer);
            for (const item of gone) pendingDeletes.current.delete(item.id);
            setItems((list) => [...gone.filter((g) => !list.some((i) => i.id === g.id)), ...list]);
          },
        },
      });
    },
    [toast, fail],
  );
  const removeItem = useCallback<Store["removeItem"]>((item) => removeItems([item]), [removeItems]);

  // One change to several items, with one undo that puts each back as it was.
  const bulkEdit = useCallback<Store["bulkEdit"]>(
    (list, patch, message) => {
      const keys = Object.keys(patch) as (keyof ItemDTO)[];
      // Finishing spends from the pot; undoing must restore the price it guessed, too.
      if (keys.includes("status")) keys.push("actualPrice");
      const before = list.map((item) => ({
        id: item.id,
        patch: Object.fromEntries(keys.map((k) => [k, item[k]])) as ItemUpdateInput,
      }));
      for (const item of list) patchItem(item.id, patch);
      toast({
        message,
        action: { label: "Undo", run: () => before.forEach((b) => patchItem(b.id, b.patch)) },
      });
    },
    [patchItem, toast],
  );

  const saveSettings = useCallback<Store["saveSettings"]>(
    async (patch) => {
      try {
        const next = await track(() => api.updateSettings(patch));
        setSettings(next);
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [fail],
  );

  // Asking only queues the question; the answer arrives with a later poll,
  // once a worker has run it past Claude.
  const askClaude = useCallback<Store["askClaude"]>(
    async (itemId, question, options) => {
      try {
        const job = await track(() =>
          api.askClaude(itemId, {
            question: question || null,
            requestedBy: me,
            autofill: options?.autofill,
            improve: options?.improve,
          }),
        );
        // It replaces the item's last answer, as it does on the server.
        setJobs((list) => [job, ...list.filter((j) => j.itemId !== itemId)]);
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [me, fail],
  );

  const updateJob = useCallback<Store["updateJob"]>(
    async (job, status) => {
      const before = jobs;
      // Used and dismissed ones leave the list; the others are (back) in it.
      setJobs((list) =>
        status === "ACCEPTED" || status === "DISMISSED"
          ? list.filter((j) => j.id !== job.id)
          : [{ ...job, status, error: status === "QUEUED" ? null : job.error }, ...list.filter((j) => j.id !== job.id)],
      );
      try {
        await track(() => api.updateJob(job.id, status));
        return true;
      } catch (err) {
        setJobs(before);
        fail(err);
        return false;
      }
    },
    [jobs, fail],
  );

  const undoImprove = useCallback<Store["undoImprove"]>(
    async (job) => {
      try {
        const { item, potDelta } = await track(() => api.undoImprove(job.id, me));
        setJobs((list) => list.filter((j) => j.id !== job.id));
        setItems((list) => list.map((i) => (i.id === item.id ? item : i)));
        adjustPot(potDelta);
        return true;
      } catch (err) {
        fail(err);
        return false;
      }
    },
    [me, fail, adjustPot],
  );

  const jobByItem = useMemo(() => {
    const map = new Map<string, AiJobDTO>();
    // Newest first, so the first seen for an item wins.
    for (const job of jobs) if (job.itemId && !map.has(job.itemId)) map.set(job.itemId, job);
    return map;
  }, [jobs]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const settling = useMemo<ReadonlyMap<string, ItemDTO>>(() => settle?.ids ?? new Map(), [settle]);
  // Anything deleted meanwhile is dropped even from the snapshot.
  const listing = useMemo(
    () => (settle ? settle.items.filter((i) => itemById.has(i.id)) : items),
    [settle, items, itemById],
  );
  const listingSettings = settle?.settings ?? settings;

  const value = useMemo<Store>(
    () => ({
      items,
      listing,
      listingSettings,
      settling,
      itemById,
      settings,
      me,
      addItem,
      addItems,
      addQuote,
      updateQuote,
      deleteQuote,
      addComment,
      deleteComment,
      addPhoto,
      deletePhoto,
      boards,
      createBoard,
      updateBoard,
      removeBoard,
      addPiece,
      updatePiece,
      removePiece,
      pieceToItem,
      payments,
      addPayment,
      updatePayment,
      togglePaid,
      removePayment,
      settleUp,
      reopenPayments,
      redateSettlement,
      readings,
      addReadings,
      removeReading,
      tradespeople,
      addTradesperson,
      updateTradesperson,
      removeTradesperson,
      events,
      addEvent,
      updateEvent,
      removeEvent,
      calendarPath,
      connectorPath,
      workerToken,
      jobs,
      jobByItem,
      askClaude,
      undoImprove,
      updateJob,
      patchItem,
      toggleDone,
      toggleStep,
      removeItem,
      removeItems,
      bulkEdit,
      saveSettings,
      toast,
      dismissToast,
      holdToast,
      toasts,
      editing,
      openItem: (id, defaults, restore) => setEditing({ id, defaults, restore }),
      closeItem: () => setEditing(null),
      justAdded,
      bulk,
      openBulk: setBulk,
      closeBulk: () => setBulk(null),
    }),
    [items, listing, listingSettings, settling, itemById, settings, me, addItem, addItems, addQuote, updateQuote, deleteQuote, addComment, deleteComment, addPhoto, deletePhoto, boards, createBoard, updateBoard, removeBoard, addPiece, updatePiece, removePiece, pieceToItem, payments, addPayment, updatePayment, togglePaid, removePayment, settleUp, reopenPayments, redateSettlement, readings, addReadings, removeReading, tradespeople, addTradesperson, updateTradesperson, removeTradesperson, events, addEvent, updateEvent, removeEvent, calendarPath, connectorPath, workerToken, jobs, jobByItem, askClaude, undoImprove, updateJob, patchItem, toggleDone, toggleStep, removeItem, removeItems, bulkEdit, saveSettings, toast, dismissToast, holdToast, toasts, editing, justAdded, bulk],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
