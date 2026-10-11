"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as api from "@/lib/api-client";
import { ApiError } from "@/lib/api-client";
import type { ItemDTO, SettingsDTO, StepDTO } from "@/lib/types";
import { formatDay, formatGBP, today } from "@/lib/format";
import { nextOccurrence } from "@/lib/types";
import { settlePot } from "@/lib/pot";
import { ROOM_PAINT } from "@/lib/rooms";
import { haptic } from "@/lib/haptics";
import type { ItemCreateInput, ItemUpdateInput, SettingsUpdateInput } from "@/lib/validation";
import type { BulkCandidate } from "@/components/BulkAddSheet";

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
  /** Private calendar subscription path for due dates. */
  calendarPath: string;
  patchItem: (id: string, patch: ItemUpdateInput) => Promise<ItemDTO | null>;
  toggleDone: (item: ItemDTO) => void;
  /** Tick (or untick) one step, straight from a list row. */
  toggleStep: (item: ItemDTO, stepId: string) => void;
  removeItem: (item: ItemDTO) => void;
  saveSettings: (patch: SettingsUpdateInput) => Promise<boolean>;
  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  toasts: Toast[];
  openItem: (id: string | "new", defaults?: Partial<ItemDTO>) => void;
  editing: { id: string | "new"; defaults?: Partial<ItemDTO> } | null;
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
const UNDO_MS = 6_000;
/** How long a ticked row lingers in an open list (matches .row-leave). */
const SETTLE_MS = 1_000;

/** The item as it will be after the patch, and how far the pot moves. */
function applyPatch(item: ItemDTO, patch: ItemUpdateInput, me: string, potTracked: boolean) {
  const next: ItemDTO = { ...item };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "steps" || key === "actor" || value === undefined) continue;
    (next as Record<string, unknown>)[key] = value;
  }
  if (next.status === "DONE" && item.status !== "DONE") {
    next.completedAt = new Date().toISOString();
    next.completedBy = me;
    if (next.actualPrice == null) next.actualPrice = next.estimatedPrice;
  }
  if (next.status !== "DONE" && item.status === "DONE") {
    next.completedAt = null;
    next.completedBy = null;
  }
  // Mirror the server's pot arithmetic so the money figures move instantly.
  const pot = settlePot(item, { status: next.status, actualPrice: next.actualPrice, steps: patch.steps }, potTracked);
  next.potCharge = pot.itemCharge;
  if (patch.steps) {
    next.steps = patch.steps.map((s, i) => {
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

/** A step as the API takes it back. */
const stepInput = ({ id, text, done, cost, link, notes }: StepDTO) => ({ id, text, done, cost, link, notes });

export function StoreProvider({
  initialItems,
  initialSettings,
  me,
  calendarPath,
  children,
}: {
  initialItems: ItemDTO[];
  initialSettings: SettingsDTO;
  me: string;
  calendarPath: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState(initialItems);
  const [settings, setSettings] = useState(initialSettings);
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
  const lastMutation = useRef(0);
  const itemsRef = useRef(items);
  const settingsRef = useRef(settings);
  useLayoutEffect(() => {
    itemsRef.current = items;
    settingsRef.current = settings;
  }, [items, settings]);

  const toastSeq = useRef(0);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++toastSeq.current;
      setToasts((list) => [...list.slice(-2), { ...t, id }]);
      window.setTimeout(() => dismissToast(id), UNDO_MS);
    },
    [dismissToast],
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
    try {
      const state = await api.fetchState();
      if (inFlight.current > 0 || pendingDeletes.current.size > 0) return;
      setItems(state.items);
      setSettings(state.settings);
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
        project: (input.project as string | null | undefined) ?? null,
        repeat: input.repeat ?? null,
        spawnedFromId: null,
        pinned: input.pinned ?? false,
        quotes: [],
        comments: [],
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
      try {
        const created = await track(() => api.createItem({ ...input, addedBy: me }));
        setItems((list) => list.map((i) => (i.id === tempId ? created : i)));
        setJustAdded(created.id);
        // What logging it took from the pot (it may have arrived already ticked).
        adjustPot(-((created.potCharge ?? 0) + created.steps.reduce((sum, s) => sum + (s.potCharge ?? 0), 0)));
        if (!settings.members.includes(me)) setSettings((s) => ({ ...s, members: [...s.members, me] }));
        return created;
      } catch (err) {
        setItems((list) => list.filter((i) => i.id !== tempId));
        fail(err);
        return null;
      }
    },
    [me, fail, adjustPot, settings.members],
  );

  const patchItem = useCallback<Store["patchItem"]>(
    async (id, patch) => {
      const before = itemsRef.current.find((i) => i.id === id);
      if (!before || id.startsWith("tmp-")) return null;
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
        secondary: cost ? { label: "Edit price", run: () => setEditing({ id: item.id }) } : undefined,
      });
    },
    [patchItem, toast, unsettle],
  );

  const toggleStep = useCallback<Store["toggleStep"]>(
    (item, stepId) => {
      const step = item.steps.find((s) => s.id === stepId);
      if (!step) return;
      const withStep = (done: boolean) => item.steps.map((s) => stepInput(s.id === stepId ? { ...s, done } : s));
      patchItem(item.id, { steps: withStep(!step.done) });
      if (step.done) return;
      haptic(8);
      const paid = step.cost != null && step.cost > 0 && settingsRef.current.potTracked;
      // The last step done: offer to finish the whole thing in the same breath.
      const last = item.status !== "DONE" && item.steps.every((s) => s.id === stepId || s.done);
      toast({
        message: paid ? `${step.text} — ${formatGBP(step.cost!)} out of the pot` : `Done: ${step.text}`,
        action: { label: "Undo", run: () => patchItem(item.id, { steps: withStep(false) }) },
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

  const removeItem = useCallback<Store["removeItem"]>(
    (item) => {
      setItems((list) => list.filter((i) => i.id !== item.id));
      // The delete only happens once the undo window closes.
      const timer = window.setTimeout(async () => {
        pendingDeletes.current.delete(item.id);
        try {
          await track(() => api.deleteItem(item.id));
        } catch (err) {
          setItems((list) => [item, ...list]);
          fail(err);
        }
      }, UNDO_MS);
      pendingDeletes.current.set(item.id, timer);
      toast({
        message: `Deleted “${item.title}”`,
        action: {
          label: "Undo",
          run: () => {
            window.clearTimeout(pendingDeletes.current.get(item.id));
            pendingDeletes.current.delete(item.id);
            setItems((list) => (list.some((i) => i.id === item.id) ? list : [item, ...list]));
          },
        },
      });
    },
    [toast, fail],
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
      calendarPath,
      patchItem,
      toggleDone,
      toggleStep,
      removeItem,
      saveSettings,
      toast,
      dismissToast,
      toasts,
      editing,
      openItem: (id, defaults) => setEditing({ id, defaults }),
      closeItem: () => setEditing(null),
      justAdded,
      bulk,
      openBulk: setBulk,
      closeBulk: () => setBulk(null),
    }),
    [items, listing, listingSettings, settling, itemById, settings, me, addItem, addItems, addQuote, updateQuote, deleteQuote, addComment, deleteComment, calendarPath, patchItem, toggleDone, toggleStep, removeItem, saveSettings, toast, dismissToast, toasts, editing, justAdded, bulk],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
