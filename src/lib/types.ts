import type { Bin } from "@/lib/bins";

export const ROOMS = [
  // A scope rather than a room — first because whole-house jobs (rewiring,
  // heating, decorating) are a common pick and the default for quick adds.
  "WHOLE_HOUSE",
  "HALLWAY",
  "SITTING_ROOM",
  "KITCHEN",
  "GAMES_ROOM",
  "UNDERSTAIR_CUPBOARD",
  "LANDING",
  "SPARE_ROOM_1",
  "SPARE_ROOM_2",
  "MASTER_BEDROOM",
  "BATHROOM_1",
  "BATHROOM_2",
  "BACK_GARDEN",
  "FRONT_GARDEN",
  "DRIVEWAY",
  "ATTIC",
] as const;
export type Room = (typeof ROOMS)[number];

export const PRIORITIES = ["MUST_HAVE", "WOULD_LIKE", "SOMEDAY"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  MUST_HAVE: "Must",
  WOULD_LIKE: "Would like",
  SOMEDAY: "Someday",
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  MUST_HAVE: 0,
  WOULD_LIKE: 1,
  SOMEDAY: 2,
};

export const KINDS = ["TASK", "BUY"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABELS: Record<Kind, string> = {
  TASK: "Job",
  BUY: "To buy",
};

export const STATUSES = ["TODO", "DOING", "DONE"] as const;
export type Status = (typeof STATUSES)[number];

// The same three states read differently for a job and a purchase.
export const STATUS_LABELS: Record<Kind, Record<Status, string>> = {
  TASK: { TODO: "To do", DOING: "Doing", DONE: "Done" },
  BUY: { TODO: "To buy", DOING: "Ordered", DONE: "Bought" },
};

// Maintenance comes round again: ticking off a repeating job schedules the
// next one from the day it was done.
export const REPEATS = ["WEEKLY", "MONTHLY", "QUARTERLY", "TWICE_YEARLY", "YEARLY"] as const;
export type Repeat = (typeof REPEATS)[number];

export const REPEAT_LABELS: Record<Repeat, string> = {
  WEEKLY: "Every week",
  MONTHLY: "Every month",
  QUARTERLY: "Every 3 months",
  TWICE_YEARLY: "Every 6 months",
  YEARLY: "Every year",
};

export const REPEAT_SHORT: Record<Repeat, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "3-monthly",
  TWICE_YEARLY: "6-monthly",
  YEARLY: "Yearly",
};

/** The calendar date one interval after `day` (YYYY-MM-DD in, out). */
export function nextOccurrence(day: string, repeat: Repeat): string {
  const [y, m, d] = day.split("-").map(Number);
  const months = { WEEKLY: 0, MONTHLY: 1, QUARTERLY: 3, TWICE_YEARLY: 6, YEARLY: 12 }[repeat];
  const next =
    repeat === "WEEKLY"
      ? new Date(Date.UTC(y, m - 1, d + 7))
      : // Clamp to the month's last day, so 31 Jan + 1 month is 28/29 Feb, not 3 Mar.
        new Date(Date.UTC(y, m - 1 + months, Math.min(d, new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate())));
  return next.toISOString().slice(0, 10);
}

export type QuoteDTO = {
  id: string;
  from: string;
  amount: number;
  note: string | null;
  chosen: boolean;
  addedBy: string;
  createdAt: string;
};

export type CommentDTO = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

export type PhotoDTO = {
  id: string;
  /** The full-size copy's pixels. */
  width: number;
  height: number;
  addedBy: string;
  createdAt: string;
};

/** Plenty for a product, before and after, and the quote on paper. */
export const PHOTOS_MAX = 24;

/** Where the app shows a photo from: the small copy for lists, or the full one. */
export const photoSrc = (id: string, size: "full" | "thumb") => `/api/photos/${id}?size=${size}`;

export type StepDTO = {
  id: string;
  text: string;
  done: boolean;
  cost: number | null;
  link: string | null;
  notes: string | null;
  /** What ticking it took from the pot; null if nothing was charged. */
  potCharge: number | null;
  doneAt: string | null;
};

/** The steps' costs, order aside, to tell whether any were changed. */
export const stepCostsKey = (steps: { cost?: number | null }[]) =>
  steps
    .flatMap((s) => (s.cost == null ? [] : [s.cost]))
    .sort((a, b) => a - b)
    .join(",");

/**
 * A sheet's edited steps, laid over the steps as they are now. Steps are
 * saved as a whole list, so without this a sheet left open would undo what
 * happened meanwhile: a step the other phone ticked (and paid for) would be
 * unticked, and steps Claude added would be deleted. Ticks this sheet didn't
 * change follow the live item; steps added elsewhere are kept, and steps
 * deleted elsewhere stay gone.
 */
export function rebaseSteps<T extends { id?: string; done?: boolean }>(
  sent: T[],
  opened: { id: string; done: boolean }[],
  live: (T & { id: string; done: boolean })[],
): T[] {
  const openedById = new Map(opened.map((s) => [s.id, s]));
  const liveById = new Map(live.map((s) => [s.id, s]));
  const kept = sent.flatMap((s) => {
    if (!s.id) return [s];
    const now = liveById.get(s.id);
    if (!now) return openedById.has(s.id) ? [] : [s];
    const before = openedById.get(s.id);
    return [before && !!s.done === before.done ? { ...s, done: now.done } : s];
  });
  const sentIds = new Set(sent.flatMap((s) => (s.id ? [s.id] : [])));
  const added: T[] = live.filter((s) => !openedById.has(s.id) && !sentIds.has(s.id));
  // Added elsewhere: after the existing steps, before the ones typed here.
  const firstNew = kept.findIndex((s) => !s.id);
  return firstNew < 0 ? [...kept, ...added] : [...kept.slice(0, firstNew), ...added, ...kept.slice(firstNew)];
}

/** The steps' total, or null when none of them has a cost. */
export function stepsTotal(steps: { cost?: number | null }[]): number | null {
  const costed = steps.filter((s) => s.cost != null);
  return costed.length ? costed.reduce((sum, s) => sum + s.cost!, 0) : null;
}

/**
 * Costing steps replaces the item's figure with their total, so a £2,000
 * quote with only its £500 deposit costed would quietly plan as £500. This
 * is how far the new total is from the figure the item had before its steps
 * set it (a quote, an estimate, or the top of a range): positive when the
 * steps leave some out, negative when they come to more. Null when there was
 * no earlier figure, the steps already set it, or the two agree.
 */
export function stepsGap(
  before: { estimatedPrice: number | null; estimateMax: number | null; steps: { cost?: number | null }[] },
  total: number | null,
): number | null {
  const figure = before.estimateMax ?? before.estimatedPrice;
  const beforeTotal = stepsTotal(before.steps);
  if (figure == null || total == null || (beforeTotal != null && before.estimatedPrice === beforeTotal)) return null;
  const gap = Math.round((figure - total) * 100) / 100;
  return gap === 0 ? null : gap;
}

export type ItemDTO = {
  id: string;
  title: string;
  kind: Kind;
  room: Room;
  priority: Priority;
  status: Status;
  estimatedPrice: number | null;
  estimateMax: number | null;
  isQuote: boolean;
  actualPrice: number | null;
  assignee: string | null;
  /** Calendar date, YYYY-MM-DD. */
  dueDate: string | null;
  /** When its guarantee runs out, YYYY-MM-DD. */
  warrantyUntil: string | null;
  project: string | null;
  repeat: Repeat | null;
  spawnedFromId: string | null;
  pinned: boolean;
  /** What finishing it took from the pot; null if nothing was charged. */
  potCharge: number | null;
  links: string[];
  notes: string | null;
  addedBy: string;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  updatedAt: string;
  steps: StepDTO[];
  quotes: QuoteDTO[];
  comments: CommentDTO[];
  photos: PhotoDTO[];
};

/** An item that isn't saved yet, for the plan to place: added now, so last in its tier. */
export function unsavedItem(id: string, title = ""): ItemDTO {
  const now = new Date().toISOString();
  return {
    id,
    title,
    kind: "TASK",
    room: "WHOLE_HOUSE",
    priority: "WOULD_LIKE",
    status: "TODO",
    estimatedPrice: null,
    estimateMax: null,
    isQuote: false,
    actualPrice: null,
    assignee: null,
    dueDate: null,
    warrantyUntil: null,
    project: null,
    repeat: null,
    spawnedFromId: null,
    pinned: false,
    potCharge: null,
    links: [],
    notes: null,
    addedBy: "",
    completedAt: null,
    completedBy: null,
    createdAt: now,
    updatedAt: now,
    steps: [],
    quotes: [],
    comments: [],
    photos: [],
  };
}

export type SettingsDTO = {
  budgetAvailable: number;
  /** Whether anyone has set up the pot; until then nothing spends from it. */
  potTracked: boolean;
  monthlySaving: number;
  members: string[];
  /** Calendar date, YYYY-MM-DD. */
  movedInOn: string | null;
  /** Calendar date, YYYY-MM-DD. */
  lastPaydayOn: string | null;
  lastPaydayBy: string | null;
  /** When the AI worker last asked for work (ISO); null if one never has. */
  workerSeenAt: string | null;
  bins: Bin[];
  /** Day of the month (1-28) for the meter reading reminder; null for none. */
  meterDay: number | null;
};

export const TITLE_MAX = 200;
