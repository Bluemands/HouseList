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

export type StepDTO = {
  id: string;
  text: string;
  done: boolean;
  cost: number | null;
  link: string | null;
  notes: string | null;
};

/** The steps' total, or null when none of them has a cost. */
export function stepsTotal(steps: { cost?: number | null }[]): number | null {
  const costed = steps.filter((s) => s.cost != null);
  return costed.length ? costed.reduce((sum, s) => sum + s.cost!, 0) : null;
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
  project: string | null;
  repeat: Repeat | null;
  spawnedFromId: string | null;
  pinned: boolean;
  /** What finishing it took out of the pot (0 if the pot wasn't in use). */
  potCharge: number;
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
};

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
};

export const TITLE_MAX = 200;
