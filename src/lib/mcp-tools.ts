import { z } from "zod";
import type { McpServer, McpTool, ToolResult } from "@/lib/mcp";
import { commentCreateSchema, itemCreateSchema, itemUpdateSchema, quoteCreateSchema } from "@/lib/validation";
import { getState } from "@/lib/data";
import { addComment, addQuote, createItems, deleteItem, getItem, updateItem, updateQuote } from "@/lib/items-service";
import {
  affordabilityIndex,
  buildPlan,
  compareForList,
  isOpen,
  matchesSearch,
  planImpact,
  roomStats,
  spending,
  upNext,
  type PlanMove,
  type PlanPlace,
} from "@/lib/plan";
import { KINDS, PRIORITIES, ROOMS, STATUS_LABELS, unsavedItem, type ItemDTO, type SettingsDTO } from "@/lib/types";
import { ROOM_PAINT } from "@/lib/rooms";
import { addDays, formatGBP, formatMonth, linkLabel, today } from "@/lib/format";
import { isShoppingStep } from "@/lib/parse";
import { AmazonUnavailable, SEARCH_RESULTS_MAX, amazonEnabled, lookupAmazon, searchAmazon } from "@/lib/amazon";

// The tools Claude gets through the connector. Everything it writes goes
// through lib/items-service, the same code the app's own routes use, so the
// pot and repeating jobs behave exactly as if someone had tapped it in.

/** Who the app says made a change through the connector. Never a household member. */
export const CLAUDE = "Claude";

class ToolError extends Error {}

// ---------------------------------------------------------------------------
// What Claude reads back. Nulls and empty lists are dropped: they cost tokens
// and say nothing.

function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v != null && v !== false && !(Array.isArray(v) && v.length === 0)),
  ) as Partial<T>;
}

/** "now", "December 2026 (after 2 more months of saving)", or why not. */
export function affordLabel(monthsAway: number | null | undefined): string | undefined {
  if (monthsAway === undefined) return undefined;
  if (monthsAway === null) return "not at the current monthly saving";
  if (monthsAway === 0) return "now (the pot covers it)";
  return `${formatMonth(monthsAway)} (after ${monthsAway} more ${monthsAway === 1 ? "month" : "months"} of saving)`;
}

/** One line's worth of an item, for lists. */
export function summarise(item: ItemDTO, afford: Map<string, number | null> = new Map()) {
  const next = item.steps.find((s) => !s.done);
  return compact({
    id: item.id,
    title: item.title,
    kind: item.kind,
    room: item.room,
    priority: item.priority,
    status: item.status,
    estimatedPrice: item.estimatedPrice,
    estimateMax: item.estimateMax,
    firmQuote: item.isQuote,
    actualPrice: item.actualPrice,
    assignee: item.assignee,
    dueDate: item.dueDate,
    project: item.project,
    repeat: item.repeat,
    pinned: item.pinned,
    steps: item.steps.length ? `${item.steps.filter((s) => s.done).length}/${item.steps.length} done` : null,
    nextStep: next?.text,
    quotes: item.quotes.length || null,
    updates: item.comments.length || null,
    affordable: isOpen(item) ? affordLabel(afford.get(item.id)) : undefined,
    addedBy: item.addedBy,
    completedBy: item.completedBy,
  });
}

/** Everything about one item, ids included, so steps and quotes can be referred to. */
export function detail(item: ItemDTO, afford: Map<string, number | null> = new Map()) {
  return compact({
    ...item,
    createdAt: undefined,
    updatedAt: undefined,
    statusLabel: STATUS_LABELS[item.kind][item.status],
    roomLabel: ROOM_PAINT[item.room].label,
    affordable: isOpen(item) ? affordLabel(afford.get(item.id)) : undefined,
    addedAt: item.createdAt,
    steps: item.steps.map((s) => compact(s)),
    quotes: item.quotes.map((q) => compact(q)),
    comments: item.comments,
  });
}

/** The household at a glance: money, the plan, what's next. */
export function overview(items: ItemDTO[], settings: SettingsDTO) {
  const plan = buildPlan(items, settings);
  const afford = affordabilityIndex(plan);
  const open = items.filter(isOpen);
  const now = today();
  const spent = spending(items);
  const tracked = settings.potTracked;
  const shown = 60;
  return {
    today: now,
    household: settings.members,
    movedInOn: settings.movedInOn,
    money: tracked
      ? compact({
          pot: settings.budgetAvailable,
          monthlySaving: settings.monthlySaving,
          lastPayday: settings.lastPaydayOn ? `${settings.lastPaydayOn} by ${settings.lastPaydayBy ?? "someone"}` : null,
          mustHavesLeaveSpare: plan.mustSpare,
          spentSoFar: spent.spent,
          paidTowardsUnfinishedJobs: spent.stagesPaid,
        })
      : {
          note: "The pot isn't set up yet (they set it under Money in the app), so nothing is tracked as affordable or not.",
          monthlySaving: settings.monthlySaving,
        },
    counts: {
      openJobs: open.filter((i) => i.kind === "TASK").length,
      openToBuy: open.filter((i) => i.kind === "BUY").length,
      inProgress: open.filter((i) => i.status === "DOING").length,
      done: items.length - open.length,
      overdue: open.filter((i) => i.dueDate && i.dueDate < now).length,
      dueInNext7Days: open.filter((i) => i.dueDate && i.dueDate >= now && i.dueDate <= addDays(now, 7)).length,
    },
    plan: compact({
      howItWorks:
        "Open costed items in plan order (pinned first, then Must → Would like → Someday, in-progress first, then due date, then oldest), paid from the pot until it runs out, then month by month from the monthly saving. Ranges count at their top figure; stages already paid are taken off.",
      openCostedTotal: plan.openTotal,
      mustHaveTotal: plan.mustTotal,
      affordableNowCount: tracked ? plan.affordableNowCount : null,
      allAffordable: tracked ? affordLabel(plan.allClearIn) : null,
      entries: plan.entries.slice(0, shown).map((e) =>
        compact({
          id: e.item.id,
          title: e.item.title,
          kind: e.item.kind,
          room: e.item.room,
          priority: e.item.priority,
          cost: e.cost,
          runningTotal: e.cumulative,
          affordable: tracked ? affordLabel(e.monthsAway) : null,
        }),
      ),
      moreEntries: plan.entries.length > shown ? plan.entries.length - shown : null,
    }),
    upNext: upNext(items, null, afford).map((i) => summarise(i, afford)),
    rooms: roomStats(items)
      .filter((r) => r.total)
      .map((r) => compact({ room: r.room, open: r.open, done: r.done, openCost: r.openCost || null, overdue: r.overdue || null })),
  };
}

const STATUS_FILTERS = ["open", "done", "all", "TODO", "DOING", "DONE"] as const;

const listInput = z.strictObject({
  kind: z.enum(KINDS).optional().describe("TASK (jobs) or BUY (things to buy)."),
  room: z.enum(ROOMS).optional(),
  status: z
    .enum(STATUS_FILTERS)
    .default("open")
    .describe("open (TODO + DOING, the default), done, all, or one exact status."),
  priority: z.enum(PRIORITIES).optional(),
  assignee: z.string().optional().describe("Exact name, e.g. a household member, 'Both' or 'Electrician'."),
  project: z.string().optional(),
  search: z
    .string()
    .optional()
    .describe("Words to find anywhere on an item: title, notes, links, steps, updates, quotes, room name."),
  dueBy: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Only items due on or before this YYYY-MM-DD (includes overdue)."),
  limit: z.number().int().min(1).max(200).default(100),
});

export function filterItems(items: ItemDTO[], f: z.output<typeof listInput>): ItemDTO[] {
  const matched = items.filter(
    (i) =>
      (!f.kind || i.kind === f.kind) &&
      (!f.room || i.room === f.room) &&
      (!f.priority || i.priority === f.priority) &&
      (!f.assignee || i.assignee?.toLowerCase() === f.assignee.toLowerCase()) &&
      (!f.project || i.project?.toLowerCase() === f.project.toLowerCase()) &&
      (!f.dueBy || (!!i.dueDate && i.dueDate <= f.dueBy)) &&
      (f.status === "all" ||
        (f.status === "open" ? isOpen(i) : f.status === "done" ? !isOpen(i) : i.status === f.status)) &&
      matchesSearch(i, f.search ?? ""),
  );
  // Open things in the app's order, then the most recently finished.
  const open = matched.filter(isOpen).sort(compareForList);
  const done = matched.filter((i) => !isOpen(i)).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return [...open, ...done];
}

// ---------------------------------------------------------------------------
// What-ifs: the item sheet's plan preview (lib/plan planImpact), for "what if
// we made the kitchen a must?" or "could we afford a £3,000 fence now?".

const previewInput = z
  .strictObject({
    id: z.string().optional().describe("The item to change, from list_items or get_overview. Leave out to preview adding a new one."),
    title: z.string().trim().min(1).max(200).optional().describe("For a new item: what it is."),
    priority: z.enum(PRIORITIES).optional(),
    pinned: z.boolean().optional().describe("Pinned items are paid for first, ahead of priority."),
    estimatedPrice: z.number().nonnegative().nullable().optional().describe("Cost in GBP pounds; null makes it free."),
    estimateMax: z.number().nonnegative().nullable().optional().describe("Top of a cost range in GBP; the plan counts this figure."),
    drop: z.boolean().optional().describe("Leave it out of the plan altogether, as if they decided not to do it."),
  })
  .refine((v) => v.id || (v.title && v.estimatedPrice != null), {
    message: "Pass an id to change an existing item, or a title and estimatedPrice to preview a new one.",
  });

const NEW_ID = "preview-new";

export function previewChange(items: ItemDTO[], settings: SettingsDTO, input: z.output<typeof previewInput>) {
  const existing = input.id ? items.find((i) => i.id === input.id) : undefined;
  if (input.id && !existing) throw gone("item", input.id);
  const base = existing ?? unsavedItem(NEW_ID, input.title);
  const changed: ItemDTO = {
    ...base,
    priority: input.priority ?? base.priority,
    pinned: input.pinned ?? base.pinned,
    estimatedPrice: input.estimatedPrice !== undefined ? input.estimatedPrice : base.estimatedPrice,
    estimateMax: input.estimateMax !== undefined ? input.estimateMax : base.estimateMax,
    ...(input.drop ? { estimatedPrice: null, estimateMax: null, steps: [] } : {}),
  };
  const impact = planImpact(items, settings, changed);
  const place = (p: PlanPlace | null) =>
    p ? compact({ affordable: affordLabel(p.monthsAway), shortToday: p.short || null, potLeftAfter: p.monthsAway === 0 ? p.spare : null }) : "not in the plan (no cost, done, or new)";
  const moves = (list: PlanMove[]) =>
    list.map((m) => ({ id: m.item.id, title: m.item.title, priority: m.item.priority, from: affordLabel(m.from), to: affordLabel(m.to) }));
  return compact({
    note: settings.potTracked
      ? "A preview only: nothing has changed. Make the change with update_item (or add_items) if they want it."
      : "The pot isn't set up yet, so the app doesn't call anything unaffordable; this counts the pot as it stands.",
    item: changed.title,
    before: place(impact.before),
    after: input.drop ? "left out of the plan" : place(impact.after),
    pushedBack: moves(impact.later),
    broughtForward: moves(impact.sooner),
  });
}

// ---------------------------------------------------------------------------
// The shopping list, as the app's To buy shows it: things to buy, and the
// supplies inside jobs ("Buy faceplates" under "Fit sockets").

const shoppingInput = z.strictObject({
  shop: z.string().optional().describe("Only things linked to this shop, e.g. 'screwfix'. Matched against the link's site."),
  room: z.enum(ROOMS).optional(),
  affordableNow: z.boolean().optional().describe("Only what the pot covers today, as the app's shopping trip does."),
});

export function shoppingList(items: ItemDTO[], afford: Map<string, number | null>, f: z.output<typeof shoppingInput> = {}) {
  const fits = (item: ItemDTO) => !f.affordableNow || !afford.has(item.id) || afford.get(item.id) === 0;
  const open = items.filter((i) => isOpen(i) && (!f.room || i.room === f.room) && fits(i)).sort(compareForList);
  const entries = [
    // Ordered things are on their way, so not for the shop.
    ...open
      .filter((i) => i.kind === "BUY" && i.status === "TODO")
      .map((i) => ({
        itemId: i.id,
        title: i.title,
        room: i.room,
        priority: i.priority,
        cost: i.estimateMax ?? i.estimatedPrice,
        link: i.links[0] ?? null,
        affordable: affordLabel(afford.get(i.id)),
      })),
    ...open.flatMap((i) =>
      i.steps
        .filter((s) => !s.done && isShoppingStep(s))
        .map((s) => ({
          itemId: i.id,
          stepId: s.id,
          title: s.text,
          forJob: i.title,
          room: i.room,
          priority: i.priority,
          cost: s.cost,
          link: s.link,
          affordable: affordLabel(afford.get(i.id)),
        })),
    ),
  ].map((e) => ({ ...e, shop: e.link ? linkLabel(e.link) : null }));
  const matched = f.shop ? entries.filter((e) => e.shop?.includes(f.shop!.toLowerCase().trim())) : entries;

  const shops = new Map<string, { shop: string; count: number; total: number }>();
  for (const e of matched) {
    const key = e.shop ?? "no shop linked";
    const s = shops.get(key) ?? { shop: key, count: 0, total: 0 };
    s.count += 1;
    s.total += e.cost ?? 0;
    shops.set(key, s);
  }
  return {
    total: matched.reduce((sum, e) => sum + (e.cost ?? 0), 0),
    byShop: [...shops.values()].sort((a, b) => b.count - a.count),
    items: matched.map((e) => compact(e)),
  };
}

// ---------------------------------------------------------------------------
// Inputs: the app's own validation, with the domain explained for Claude.

const ROOM_DOC = ROOMS.map((r) => `${r} (${ROOM_PAINT[r].label})`).join(", ");

const FIELD_DOCS: Record<string, string> = {
  title: "Short name, as they'd say it: 'Rewire the house', 'Tile bathroom 1 floor'.",
  kind: "TASK = a job to do (the default); BUY = a thing to buy.",
  room: `Where it belongs: ${ROOM_DOC}. WHOLE_HOUSE is the default and suits house-wide jobs (rewiring, heating, decorating throughout).`,
  priority: "MUST_HAVE (shown as Must), WOULD_LIKE (the default) or SOMEDAY. Sets its place in the plan.",
  status:
    "TODO, DOING (in progress; for purchases, ordered) or DONE (done; bought). DONE spends its cost from the pot (see the server instructions).",
  estimatedPrice: "Estimated cost in GBP pounds (450 means £450). With estimateMax, the bottom of a range.",
  estimateMax: "Top of a cost range in GBP. The plan budgets at this figure. Null for a single figure.",
  isQuote: "True when the cost is a firm quote rather than a guess.",
  actualPrice: "What it actually cost in GBP, once done.",
  assignee: "Who's on it: a household member's name (get_overview → household), 'Both', or a trade such as 'Electrician'.",
  dueDate: "YYYY-MM-DD. Lands in their phone calendars with a 9am reminder.",
  warrantyUntil: "YYYY-MM-DD its guarantee runs out; the calendar reminds them a month before.",
  project: "Optional tag grouping related items across rooms, e.g. 'Kitchen refit'.",
  repeat: "Maintenance that comes round again: WEEKLY, MONTHLY, QUARTERLY, TWICE_YEARLY or YEARLY. Finishing one schedules the next.",
  pinned: "Pinned items lead Up next and the plan, ahead of the automatic order. Only when they ask.",
  links: "Full https:// URLs: product pages, guides, the sources behind a price. Up to 20.",
  notes: "Plain text, up to 4000 characters: findings, specs, questions for the tradesperson.",
  steps:
    "Checklist of stages, in order. Each: text (required), cost in GBP (a stage payment, or a supply's price), link, notes, done. When any step has a cost, the item's estimate becomes the total of the step costs (replacing a range or a chosen quote), so cost every stage or none. A step starting 'Buy …' (or with both a link and a cost) also shows under To buy → For jobs, which is how supplies for a job reach the shopping list.",
};

const UPDATE_DOCS: Record<string, string> = {
  steps:
    "Replaces the whole checklist. Steps with an id (from get_item) keep it; steps without an id are new; existing steps left out are deleted. To add steps without touching the rest, use appendSteps instead.",
  stepDone: "Tick or untick one step by id ({ id, done }), against the steps as they are now.",
};

function describeShape<T extends z.ZodRawShape>(shape: T, docs: Record<string, string>): T {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [key, docs[key] ? (schema as z.ZodType).describe(docs[key]) : schema]),
  ) as T;
}

const newItem = z.strictObject(
  describeShape(itemCreateSchema.omit({ addedBy: true, stepDone: true }).shape, FIELD_DOCS),
);
const addInput = z.strictObject({ items: z.array(newItem).min(1).max(100) });

const updateInput = z.strictObject({
  id: z.string().describe("The item's id, from list_items or get_overview."),
  ...describeShape(itemUpdateSchema.omit({ actor: true }).shape, { ...FIELD_DOCS, ...UPDATE_DOCS }),
  appendSteps: itemUpdateSchema.shape.steps.describe(
    "Steps to add after the existing ones (same shape as steps, no ids). Can't be combined with steps.",
  ),
});

const idInput = (what: string) => z.strictObject({ id: z.string().describe(`The ${what}'s id.`) });

const quoteInput = z.strictObject({
  itemId: z.string().describe("The job's id."),
  from: quoteCreateSchema.shape.from.describe("Who quoted: the firm or tradesperson."),
  amount: quoteCreateSchema.shape.amount.describe("The quoted total in GBP pounds."),
  note: quoteCreateSchema.shape.note.describe("What's included or excluded, validity, the date of the visit…"),
  choose: z
    .boolean()
    .optional()
    .describe("Also go with this quote: sets the item's cost to it and marks it a firm quote. Only when they've decided."),
});

const chooseInput = z.strictObject({
  quoteId: z.string().describe("The quote's id, from get_item."),
  chosen: z.boolean().default(true).describe("false un-chooses it (the cost stays, but it's no longer a firm quote)."),
});

const commentInput = z.strictObject({
  itemId: z.string(),
  text: commentCreateSchema.shape.text.describe("The update, as a short note to them: what you found, what's next."),
});

// ---------------------------------------------------------------------------

const ok = (value: unknown): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(value) }] });
const fail = (message: string): ToolResult => ({ content: [{ type: "text", text: message }], isError: true });

function tool<S extends z.ZodType>(def: {
  name: string;
  title: string;
  description: string;
  input: S;
  annotations: McpTool["annotations"];
  run: (args: z.output<S>) => Promise<unknown>;
}): McpTool {
  const inputSchema: Record<string, unknown> = z.toJSONSchema(def.input, { io: "input", unrepresentable: "any" });
  // 2020-12 is MCP's default dialect; naming it only trips up stricter clients.
  delete inputSchema.$schema;
  return {
    name: def.name,
    title: def.title,
    description: def.description,
    inputSchema,
    annotations: { openWorldHint: false, ...def.annotations },
    async run(args) {
      const parsed = def.input.safeParse(args);
      if (!parsed.success) return fail(`Those arguments didn't fit:\n${z.prettifyError(parsed.error)}`);
      try {
        return ok(await def.run(parsed.data));
      } catch (err) {
        if (err instanceof ToolError) return fail(err.message);
        throw err;
      }
    },
  };
}

const gone = (what: string, id: string) =>
  new ToolError(`No ${what} with id ${id}. It may have been deleted; list_items finds current ids.`);

/** The plan's view of every item, for tagging results with when they're affordable. */
async function withAffordability() {
  const { items, settings } = await getState();
  return { items, settings, afford: affordabilityIndex(buildPlan(items, settings)) };
}

async function itemDetail(id: string) {
  const { items, afford } = await withAffordability();
  const item = items.find((i) => i.id === id);
  if (!item) throw gone("item", id);
  return detail(item, afford);
}

export const TOOLS: McpTool[] = [
  tool({
    name: "get_overview",
    title: "Overview and budget plan",
    description:
      "Start here. The household's names, today's date, the pot (money available now, GBP) and monthly saving, counts, and the affordability plan: every open costed item in plan order with its running total and when it becomes affordable ('now' = the pot covers it today; otherwise the month the savings reach it). Also the app's Up next list and per-room progress. Use it for 'what can we afford this month?', 'what should we do next?', or to find ids.",
    input: z.strictObject({}),
    annotations: { readOnlyHint: true, idempotentHint: true },
    async run() {
      const { items, settings } = await getState();
      return overview(items, settings);
    },
  }),
  tool({
    name: "list_items",
    title: "Find items",
    description:
      "Search and filter the list. Returns compact summaries (with ids) in the app's order: open items by plan order, then the most recently finished. Defaults to open items only. Use search to find an item by name before adding something that may already exist.",
    input: listInput,
    annotations: { readOnlyHint: true, idempotentHint: true },
    async run(filters) {
      const { items, afford } = await withAffordability();
      const matched = filterItems(items, filters);
      return compact({
        total: matched.length,
        shown: Math.min(matched.length, filters.limit),
        items: matched.slice(0, filters.limit).map((i) => summarise(i, afford)),
      });
    },
  }),
  tool({
    name: "preview_change",
    title: "Preview a change to the plan",
    description:
      "What-if, without changing anything: what a different priority, a pin, a new cost, dropping an item, or adding a new costed one would do to the affordability plan. Returns when the item becomes affordable before and after (with how far short the pot is today, or what's left after it), and every other item pushed back or brought forward, with from/to. Use it for 'what if we made the kitchen a must?', 'what would we have to put off to do the bathroom now?' or 'could we afford a £3,000 fence?', then make the change with update_item or add_items only if they want it. This is the same preview the app's item sheet shows.",
    input: previewInput,
    annotations: { readOnlyHint: true, idempotentHint: true },
    async run(input) {
      const { items, settings } = await getState();
      return previewChange(items, settings, input);
    },
  }),
  tool({
    name: "shopping_list",
    title: "Shopping list",
    description:
      "What's still to buy, as the app's To buy list shows it: open things to buy (not ones already ordered) and the supplies inside jobs (steps like 'Buy socket faceplates'), each with its cost, link, shop (the link's site), room and when it's affordable, plus totals by shop. Filter by shop ('screwfix'), room, or affordableNow for what the pot covers today. To tick something off once bought: update_item with status DONE for a thing to buy, or stepDone for a supply (itemId + stepId); both spend from the pot like ticking it in the app, so only when they say they've bought it.",
    input: shoppingInput,
    annotations: { readOnlyHint: true, idempotentHint: true },
    async run(filters) {
      const { items, afford } = await withAffordability();
      return shoppingList(items, afford, filters);
    },
  }),
  tool({
    name: "get_item",
    title: "Get one item",
    description: "Everything about one item: steps (with ids), quotes (with ids, cheapest first), updates, links, notes, costs, who and when.",
    input: idInput("item"),
    annotations: { readOnlyHint: true, idempotentHint: true },
    run: ({ id }) => itemDetail(id),
  }),
  tool({
    name: "add_items",
    title: "Add items",
    description:
      "Add one or more jobs or things to buy (up to 100), attributed to Claude. Only title is required; everything else is optional and can be filled in later. Check list_items first so you don't duplicate something already there; update it instead. New items start open (TODO or DOING). To log something already finished, add it and then set status DONE with update_item.",
    input: addInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async run({ items }) {
      if (items.some((i) => i.status === "DONE")) {
        throw new ToolError("New items can't start as DONE. Add them as TODO, then set status DONE with update_item.");
      }
      const added = await createItems({ addedBy: CLAUDE, items }, { addMember: false });
      return { added: added.map((i) => summarise(i)) };
    },
  }),
  tool({
    name: "update_item",
    title: "Update an item",
    description:
      "Change any fields of one item; only the fields you pass change (null clears an optional field). Steps: appendSteps adds to the checklist, steps replaces it, stepDone ticks one. Setting status DONE marks it done (or bought) by Claude and, once the pot is in use, takes its cost out of the pot exactly as ticking it off in the app does; reopening puts the money back. A repeating job schedules its next round when finished. Only mark things done when they've told you so. Returns the item as it now is.",
    input: updateInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async run({ id, appendSteps, ...changes }) {
      if (appendSteps && changes.steps) throw new ToolError("Pass steps (to replace) or appendSteps (to add), not both.");
      if (!appendSteps?.length && !Object.values(changes).some((v) => v !== undefined)) {
        throw new ToolError("Nothing to change: pass at least one field.");
      }
      const result = await updateItem(id, { ...changes, actor: CLAUDE }, { appendSteps });
      if (!result) throw gone("item", id);
      return compact({
        item: await itemDetail(id),
        pot: result.potDelta
          ? `${formatGBP(Math.abs(result.potDelta))} ${result.potDelta < 0 ? "taken from" : "put back into"} the pot`
          : null,
        nextRoundScheduled: result.spawned ? summarise(result.spawned) : null,
        removedNextRound: result.removedIds,
      });
    },
  }),
  tool({
    name: "add_quote",
    title: "Log a quote",
    description:
      "Log a tradesperson's quote against a job (from a photo, an email, or what they tell you), attributed to Claude. Quotes sit side by side on the job so they can compare; the cheapest is flagged. Set choose only when they've decided to go with it.",
    input: quoteInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async run({ itemId, choose, ...quote }) {
      const quoteId = await addQuote(itemId, { ...quote, addedBy: CLAUDE });
      if (!quoteId) throw gone("item", itemId);
      if (choose) await updateQuote(quoteId, { chosen: true });
      return { quoteId, item: await itemDetail(itemId) };
    },
  }),
  tool({
    name: "choose_quote",
    title: "Choose a quote",
    description:
      "Go with one of a job's quotes: it becomes the job's cost (a firm quote) and any other chosen quote is unchosen. chosen: false undoes it.",
    input: chooseInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async run({ quoteId, chosen }) {
      const itemId = await updateQuote(quoteId, { chosen });
      if (!itemId) throw gone("quote", quoteId);
      return { item: await itemDetail(itemId) };
    },
  }),
  tool({
    name: "add_comment",
    title: "Post an update",
    description:
      "Post an update on an item's thread, signed Claude: a research summary, a price check, what to ask the tradesperson. Both of them see it on the item and in 'since you last looked'.",
    input: commentInput,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async run({ itemId, text }) {
      if (!(await addComment(itemId, { text, author: CLAUDE }))) throw gone("item", itemId);
      return { posted: true, item: await itemDetail(itemId) };
    },
  }),
  tool({
    name: "delete_item",
    title: "Delete an item",
    description:
      "Permanently delete an item with its steps, quotes and updates. There's no undo from here (the app's undo toast only covers deletes made in the app), and money already spent on it isn't put back in the pot. Only when they explicitly ask to delete it; for finished things set status DONE instead.",
    input: idInput("item"),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async run({ id }) {
      const item = await getItem(id);
      if (!item) throw gone("item", id);
      await deleteItem(id);
      return { deleted: item.title };
    },
  }),
];

// ---------------------------------------------------------------------------
// Amazon prices (lib/amazon), when the app has a price service key: for the
// connector, and on their own for the Ask Claude worker, whose web fetch
// Amazon turns away.

async function fromAmazon<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    if (err instanceof AmazonUnavailable) throw new ToolError(err.message);
    throw err;
  }
}

export const AMAZON_TOOLS: McpTool[] = [
  tool({
    name: "get_amazon_product",
    title: "Amazon price",
    description:
      "The current price, stock and seller of one Amazon product, from its link (amazon.co.uk/dp/…, or an amzn.eu/d/… share link) or ASIN. Amazon's own pages can't be opened, so use this for any Amazon price rather than guessing. The price is for the listing as sold: check the title for pack sizes. url is a clean link to the product.",
    input: z.strictObject({
      link: z.string().trim().min(1).max(2000).describe("An Amazon product link, or its 10-character ASIN."),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    async run({ link }) {
      const product = await fromAmazon(() => lookupAmazon(link));
      if (!product) throw new ToolError("That isn't an Amazon product link, or Amazon no longer lists it.");
      return product;
    },
  }),
  tool({
    name: "search_amazon",
    title: "Search Amazon UK",
    description: `Search Amazon UK: the top ${SEARCH_RESULTS_MAX} products with a price, in Amazon's order, sponsored last. For finding Amazon options to compare with other shops; prices are each listing's as sold (check titles for pack sizes). Each search costs the household money, so search for exactly what's needed and don't repeat a search.`,
    input: z.strictObject({
      query: z.string().trim().min(2).max(200).describe("What to search for, as you'd type it into Amazon: 'interlinked smoke alarm 10 year'."),
      maxPrice: z.number().positive().optional().describe("Leave out anything dearer than this, in pounds."),
    }),
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    async run({ query, maxPrice }) {
      const results = await fromAmazon(() => searchAmazon(query, maxPrice));
      return results.length ? { results } : { results, note: "Nothing priced came back for that search." };
    },
  }),
];

/** What the Ask Claude worker gets: Amazon prices, and nothing that can touch the list. */
export const PRICE_SERVER: McpServer = {
  name: "house-list-prices",
  title: "The House List: Amazon prices",
  version: "1.0.0",
  instructions:
    "Current Amazon UK prices, for researching what to buy. Use these for any Amazon price: Amazon's pages can't be opened with web fetch.",
  tools: AMAZON_TOOLS,
};

const AMAZON_INSTRUCTIONS = `
- Amazon's pages can't be opened directly: get_amazon_product reads an Amazon link's current price, and search_amazon finds Amazon UK options. Each call costs them a little, so don't repeat one.`;

export const SERVER: McpServer = {
  name: "house-list",
  title: "The House List",
  version: "1.0.0",
  instructions: `The House List is a couple's shared to-do list and budget planner for the house they've just bought (UK). You're working on their real list; both of them see every change on their phones within seconds, attributed to "Claude".

Items are jobs (kind TASK) or things to buy (kind BUY), each filed under one room (WHOLE_HOUSE for house-wide work) with a priority: MUST_HAVE, WOULD_LIKE or SOMEDAY. Status is TODO, DOING or DONE (for purchases these read To buy, Ordered, Bought). Cost is optional: an estimate, or a range (estimatedPrice to estimateMax), possibly a firm quote. Money is GBP, in pounds.

The pot is the money they have now; the monthly saving tops it up. The plan spends the pot on open costed items in priority order (pinned first), and dates the rest month by month from savings, so every item gets an "affordable now" or "affordable from <month>". Once the pot is set up, finishing a costed item takes its cost out of the pot automatically (ticking a costed step pays that stage), and reopening puts it back. So only mark things DONE when they've told you they're done.

Working well with them:
- Call get_overview or list_items first. Update existing items rather than adding duplicates.
- When you research a cost, put the range on the item (estimatedPrice/estimateMax, UK prices including VAT and labour where relevant), the sources in links, and a short summary as an update with add_comment.
- Break big jobs into steps; supplies for a DIY job go in as steps starting "Buy …" with a cost and product link, which puts them on the To buy list under For jobs. Step costs add up to the job's estimate (replacing any range or quote), so for a job priced by a tradesperson, leave step costs off. Standalone purchases are BUY items.
- For "what if…" money questions (a different priority, pinning something, dropping it, a big new cost), preview_change shows what moves in the plan before anything changes. For "what do we need from the shops?", shopping_list gathers things to buy and the supplies inside jobs.
- Assignees are household members (get_overview → household), "Both", or a trade like "Electrician". Never assign Claude.
- Dates are YYYY-MM-DD; get_overview tells you today's date.${amazonEnabled() ? AMAZON_INSTRUCTIONS : ""}`,
  tools: amazonEnabled() ? [...TOOLS, ...AMAZON_TOOLS] : TOOLS,
};
