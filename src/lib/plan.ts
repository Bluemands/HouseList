import { PRIORITY_ORDER, ROOMS, type ItemDTO, type Room, type SettingsDTO } from "@/lib/types";
import { dayDiff, formatMonth, today } from "@/lib/format";
import { doneStepsCost } from "@/lib/pot";
import { ROOM_PAINT } from "@/lib/rooms";

export const isOpen = (item: ItemDTO) => item.status !== "DONE";

/** What planning assumes an open item still costs: the top of its range, less stages already done. */
export function planCost(item: ItemDTO): number {
  return Math.max(0, (item.estimateMax ?? item.estimatedPrice ?? 0) - doneStepsCost(item.steps));
}

/** What a finished item actually cost. */
export function spentCost(item: ItemDTO): number {
  return item.actualPrice ?? item.estimatedPrice ?? 0;
}

/** Priority → due date → oldest first. In-progress work leads its tier. */
export function compareItems(a: ItemDTO, b: ItemDTO): number {
  if (a.status !== b.status) {
    if (a.status === "DONE") return 1;
    if (b.status === "DONE") return -1;
  }
  const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  if (p) return p;
  if (a.status === "DOING" && b.status !== "DOING") return -1;
  if (b.status === "DOING" && a.status !== "DOING") return 1;
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.createdAt < b.createdAt ? -1 : 1;
}

/** For lists people read: anything pinned by hand comes first. */
export function compareForList(a: ItemDTO, b: ItemDTO): number {
  if (a.pinned !== b.pinned && a.status !== "DONE" && b.status !== "DONE") return a.pinned ? -1 : 1;
  return compareItems(a, b);
}

// ---------------------------------------------------------------------------
// The affordability plan: walk every open costed item in priority order and
// spend the pot on it. Whatever the pot can't cover waits for monthly savings.
// Pinned items go first — "we've decided this is next" applies to money too.

export type PlanEntry = {
  item: ItemDTO;
  cost: number;
  /** Running total including this item. */
  cumulative: number;
  /** 0 = affordable now; n = n months of saving away; null = never at current saving. */
  monthsAway: number | null;
};

export type Plan = {
  entries: PlanEntry[];
  /** Whether the pot is in use; until it is, nothing is "not affordable". */
  tracked: boolean;
  pot: number;
  monthly: number;
  mustTotal: number;
  openTotal: number;
  /** Pot minus every open must-have. Negative = short. */
  mustSpare: number;
  /** Months until every open costed item is affordable; null if never. */
  allClearIn: number | null;
  affordableNowCount: number;
};

export function buildPlan(items: ItemDTO[], settings: SettingsDTO): Plan {
  const pot = settings.budgetAvailable;
  const monthly = settings.monthlySaving;
  const costed = items.filter((i) => isOpen(i) && planCost(i) > 0).sort(compareForList);

  let cumulative = 0;
  const entries: PlanEntry[] = costed.map((item) => {
    const cost = planCost(item);
    cumulative += cost;
    const short = cumulative - pot;
    const monthsAway = short <= 0 ? 0 : monthly > 0 ? Math.ceil(short / monthly) : null;
    return { item, cost, cumulative, monthsAway };
  });

  const mustTotal = costed.filter((i) => i.priority === "MUST_HAVE").reduce((s, i) => s + planCost(i), 0);
  const last = entries.at(-1);
  return {
    entries,
    tracked: settings.potTracked,
    pot,
    monthly,
    mustTotal,
    openTotal: cumulative,
    mustSpare: pot - mustTotal,
    allClearIn: last ? last.monthsAway : 0,
    affordableNowCount: entries.filter((e) => e.monthsAway === 0).length,
  };
}

/** Item id → months until affordable, for tagging rows. */
export function affordabilityIndex(plan: Plan): Map<string, number | null> {
  if (!plan.tracked) return new Map();
  return new Map(plan.entries.map((e) => [e.item.id, e.monthsAway]));
}

// ---------------------------------------------------------------------------
// What a change does to the plan: the same plan worked out twice, with the
// item as it is and as it would be, so "if we made it a must…" or "if we
// pinned it…" is answered before anything is saved. Moving one thing up the
// order moves others down, so those are named too.

/** Where an item sits in the plan. */
export type PlanPlace = {
  /** As PlanEntry: 0 = now, n = months of saving away, null = never at current saving. */
  monthsAway: number | null;
  /** How far the pot is from covering it and everything ahead of it today. */
  short: number;
  /** What's left in the pot after it and everything ahead of it. */
  spare: number;
  /** How many costed things the plan pays for first. */
  ahead: number;
};

export type PlanMove = { item: ItemDTO; from: number | null; to: number | null };

export type PlanImpact = {
  /** Null when it isn't in the plan: new, free, or done. */
  before: PlanPlace | null;
  after: PlanPlace | null;
  /** Everything else that becomes affordable later, or sooner, in plan order. */
  later: PlanMove[];
  sooner: PlanMove[];
};

/** Never is later than any month. */
const monthsRank = (m: number | null) => (m === null ? Infinity : m);

function placeIn(plan: Plan, id: string): PlanPlace | null {
  const ahead = plan.entries.findIndex((e) => e.item.id === id);
  if (ahead < 0) return null;
  const entry = plan.entries[ahead];
  return {
    monthsAway: entry.monthsAway,
    short: Math.max(0, entry.cumulative - plan.pot),
    spare: Math.max(0, plan.pot - entry.cumulative),
    ahead,
  };
}

/**
 * The plan before and after some items change (edited, or new), and whose
 * dates that moves among the rest. Other items keep their own details; only
 * their place in the queue can change.
 */
export function planShifts(items: ItemDTO[], settings: SettingsDTO, changed: ItemDTO[]) {
  const ids = new Set(changed.map((i) => i.id));
  const before = buildPlan(items, settings);
  const after = buildPlan([...items.filter((i) => !ids.has(i.id)), ...changed], settings);
  const was = new Map(before.entries.map((e) => [e.item.id, e.monthsAway]));
  const later: PlanMove[] = [];
  const sooner: PlanMove[] = [];
  for (const e of after.entries) {
    if (ids.has(e.item.id) || !was.has(e.item.id)) continue;
    const from = was.get(e.item.id)!;
    if (monthsRank(e.monthsAway) > monthsRank(from)) later.push({ item: e.item, from, to: e.monthsAway });
    else if (monthsRank(e.monthsAway) < monthsRank(from)) sooner.push({ item: e.item, from, to: e.monthsAway });
  }
  return { before, after, later, sooner };
}

/** The plan's answer for `changed` (an item as edited, or a new one) against the list as it is. */
export function planImpact(items: ItemDTO[], settings: SettingsDTO, changed: ItemDTO): PlanImpact {
  const { before, after, later, sooner } = planShifts(items, settings, [changed]);
  return { before: placeIn(before, changed.id), after: placeIn(after, changed.id), later, sooner };
}

/** "now", "Apr 2027", or "not at current savings". */
export function describeWhen(months: number | null, long = false): string {
  if (months === 0) return "now";
  if (months === null) return "not at current savings";
  return formatMonth(months, long);
}

/** “Sofa” (to Apr 2027), or “Sofa” (to Apr 2027) and 2 more. Quoted, as titles can have commas. */
export function describeMoves(moves: PlanMove[]): string {
  const [first, ...rest] = moves;
  const title = first.item.title.length > 40 ? `${first.item.title.slice(0, 38).trimEnd()}…` : first.item.title;
  const lead = `“${title}” (to ${describeWhen(first.to)})`;
  return rest.length ? `${lead} and ${rest.length} more` : lead;
}

// ---------------------------------------------------------------------------
// Up next: the handful of things most worth doing now.

export function upNext(items: ItemDTO[], me: string | null, afford: Map<string, number | null>, limit = 5) {
  const now = today();
  const score = (item: ItemDTO) => {
    let s = 0;
    // "We've decided this is next" beats anything the maths says.
    if (item.pinned) s += 5000;
    if (item.dueDate) {
      const d = dayDiff(now, item.dueDate);
      if (d < 0) s += 1000 - d;
      else if (d <= 7) s += 500 - d * 10;
      else if (d <= 30) s += 120;
    }
    if (item.status === "DOING") s += 300;
    s += [220, 90, 0][PRIORITY_ORDER[item.priority]];
    if (me && (item.assignee === me || item.assignee === "Both")) s += 40;
    // Something you can't afford yet isn't really "next".
    const months = afford.get(item.id);
    if (months !== undefined && months !== 0) s -= 150;
    s += Math.min(30, Math.max(0, dayDiff(item.createdAt.slice(0, 10), now)));
    return s;
  };
  return items
    .filter(isOpen)
    .map((item) => ({ item, s: score(item) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item);
}

// ---------------------------------------------------------------------------
// Search: everything written on an item, so "electrician" finds the job the
// electrician quoted for.

export function matchesSearch(item: ItemDTO, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    item.title,
    item.notes,
    item.assignee,
    item.project,
    ROOM_PAINT[item.room].label,
    ...item.links,
    ...item.steps.map((s) => `${s.text} ${s.notes ?? ""} ${s.link ?? ""}`),
    ...item.comments.map((c) => c.text),
    ...item.quotes.map((q) => `${q.from} ${q.note ?? ""}`),
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

// ---------------------------------------------------------------------------
// Rooms: how far along each one is.

export type RoomStats = {
  room: Room;
  open: number;
  done: number;
  total: number;
  openCost: number;
  spent: number;
  overdue: number;
};

export function roomStats(items: ItemDTO[]): RoomStats[] {
  const now = today();
  const map = new Map<Room, RoomStats>(
    ROOMS.map((room) => [room, { room, open: 0, done: 0, total: 0, openCost: 0, spent: 0, overdue: 0 }]),
  );
  for (const item of items) {
    const r = map.get(item.room)!;
    r.total += 1;
    if (isOpen(item)) {
      r.open += 1;
      r.openCost += planCost(item);
      r.spent += doneStepsCost(item.steps);
      if (item.dueDate && item.dueDate < now) r.overdue += 1;
    } else {
      r.done += 1;
      r.spent += spentCost(item);
    }
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Spending: what's gone out, and how good the guesses were.

export function spending(items: ItemDTO[]) {
  const done = items.filter((i) => !isOpen(i));
  const compared = done.filter((i) => i.actualPrice != null && i.estimatedPrice != null);
  const estimated = compared.reduce((s, i) => s + (i.estimateMax ?? i.estimatedPrice!), 0);
  const actual = compared.reduce((s, i) => s + i.actualPrice!, 0);

  const months: { key: string; total: number }[] = [];
  const now = new Date();
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, total: 0 });
  }
  // Money goes out when it's paid: stages as they're ticked, the rest when
  // the item is finished.
  let spent = 0;
  let stagesPaid = 0;
  const pay = (when: string | null, amount: number) => {
    if (amount <= 0) return;
    spent += amount;
    if (!when) return;
    const d = new Date(when);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = months.find((m) => m.key === key);
    if (bucket) bucket.total += amount;
  };
  for (const i of items) {
    for (const s of i.steps) {
      if (s.done && s.cost) {
        pay(s.doneAt ?? i.completedAt, s.cost);
        if (isOpen(i)) stagesPaid += s.cost;
      }
    }
    if (!isOpen(i)) pay(i.completedAt, spentCost(i) - doneStepsCost(i.steps));
  }

  return {
    spent,
    /** Paid towards things not finished yet. */
    stagesPaid,
    doneCount: done.length,
    comparedCount: compared.length,
    estimateDelta: estimated > 0 ? (actual - estimated) / estimated : null,
    months,
  };
}
