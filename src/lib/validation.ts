import { z } from "zod";
import { KINDS, PRIORITIES, REPEATS, ROOMS, STATUSES, TITLE_MAX } from "@/lib/types";
import { BOARD_NAME_MAX, PIECE_KINDS } from "@/lib/boards";
import { DESCRIPTION_MAX } from "@/lib/payments";
import { BINS_MAX } from "@/lib/bins";
import { METERS } from "@/lib/meters";
import { VERDICTS } from "@/lib/tradespeople";

const emptyToNull = (val: unknown) => (typeof val === "string" && val.trim() === "" ? null : val);

const money = z
  .number({ error: "Enter a number" })
  .min(0, "Can't be negative")
  .max(10_000_000, "That looks too large");

const optionalMoney = money.nullable().optional();

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a real date")
  // Round-tripped, because 31 February parses fine as 3 March.
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Use a real date");

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, `Keep it under ${max} characters`).nullable()).optional();

const optionalUrl = z
  .preprocess(emptyToNull, z.url({ error: "Enter a full link, e.g. https://…" }).nullable())
  .optional();

const stepInput = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(1).max(200),
  done: z.boolean().optional(),
  cost: optionalMoney,
  link: optionalUrl,
  notes: optionalText(1000),
});

const title = z
  .string({ error: "Give it a name" })
  .trim()
  .min(1, "Give it a name")
  .max(TITLE_MAX, `Keep it under ${TITLE_MAX} characters`);

const itemFields = {
  kind: z.enum(KINDS).optional(),
  room: z.enum(ROOMS).optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(STATUSES).optional(),
  estimatedPrice: optionalMoney,
  estimateMax: optionalMoney,
  isQuote: z.boolean().optional(),
  actualPrice: optionalMoney,
  assignee: optionalText(60),
  dueDate: isoDate.nullable().optional(),
  warrantyUntil: isoDate.nullable().optional(),
  project: optionalText(60),
  repeat: z.enum(REPEATS).nullable().optional(),
  pinned: z.boolean().optional(),
  links: z.array(z.url({ error: "Enter a full link, e.g. https://…" })).max(20).optional(),
  notes: optionalText(4000),
  steps: z.array(stepInput).max(50).optional(),
  // One step ticked from a list row, applied to the steps as they are on the
  // server — so it can't undo a change the other phone just made to another.
  stepDone: z.object({ id: z.string(), done: z.boolean() }).optional(),
};

export const itemCreateSchema = z.object({
  title,
  addedBy: z.string({ error: "Missing name" }).trim().min(1, "Missing name").max(60),
  ...itemFields,
});

export const itemBulkCreateSchema = z.object({
  addedBy: z.string({ error: "Missing name" }).trim().min(1, "Missing name").max(60),
  items: z.array(itemCreateSchema.omit({ addedBy: true })).min(1).max(100),
});

export const itemUpdateSchema = z.object({
  title: title.optional(),
  // Who made the change — recorded as completedBy when it completes the item.
  actor: z.string().trim().max(60).optional(),
  ...itemFields,
});

export const quoteCreateSchema = z.object({
  from: z.string({ error: "Who's the quote from?" }).trim().min(1, "Who's the quote from?").max(80),
  amount: money,
  note: optionalText(500),
  addedBy: z.string().trim().min(1).max(60),
});

export const quoteUpdateSchema = z.object({
  from: z.string().trim().min(1).max(80).optional(),
  amount: money.optional(),
  note: optionalText(500),
  chosen: z.boolean().optional(),
});

export const commentCreateSchema = z.object({
  text: z.string({ error: "Write something first" }).trim().min(1, "Write something first").max(1000),
  author: z.string().trim().min(1).max(60),
});

// The rest of a photo upload; the images are checked as they arrive.
export const photoCreateSchema = z.object({
  width: z.coerce.number().int().min(1).max(8192),
  height: z.coerce.number().int().min(1).max(8192),
  addedBy: z.string().trim().min(1).max(60),
});

const boardName = z
  .string({ error: "Give the board a name" })
  .trim()
  .min(1, "Give the board a name")
  .max(BOARD_NAME_MAX, `Keep it under ${BOARD_NAME_MAX} characters`);

export const boardCreateSchema = z.object({
  name: boardName,
  room: z.enum(ROOMS).nullable().optional(),
  createdBy: z.string().trim().min(1).max(60),
});

export const boardUpdateSchema = z.object({
  name: boardName.optional(),
  room: z.enum(ROOMS).nullable().optional(),
});

// Board units; generous bounds, as the board only grows downward.
const coord = z.number().finite().min(-1000).max(100_000);
const size = z.number().finite().min(20).max(2000);
const colour = z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a colour");

const pieceFields = {
  x: coord,
  y: coord,
  w: size,
  h: size,
  title: optionalText(TITLE_MAX),
  price: optionalMoney,
  text: optionalText(1000),
  color: colour.nullable().optional(),
};

// A photo's images arrive beside this, in the same upload.
export const pieceCreateSchema = z.object({
  kind: z.enum(PIECE_KINDS),
  ...pieceFields,
  aspect: z.number().finite().min(0.05).max(20).nullable().optional(),
  itemId: z.string().max(40).nullable().optional(),
  url: optionalUrl,
  site: optionalText(80),
  addedBy: z.string().trim().min(1).max(60),
});

export const pieceUpdateSchema = z.object({
  x: coord.optional(),
  y: coord.optional(),
  w: size.optional(),
  h: size.optional(),
  z: z.number().int().min(0).max(1_000_000).optional(),
  title: pieceFields.title,
  price: pieceFields.price,
  text: pieceFields.text,
  color: pieceFields.color,
});

// What an idea becomes on the list.
export const pieceToItemSchema = z.object({
  title,
  kind: z.enum(KINDS),
  room: z.enum(ROOMS),
  addedBy: z.string().trim().min(1).max(60),
});

export const binSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1, "Name the bin").max(40),
  colour: z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a colour"),
  everyWeeks: z.number().int().min(1).max(4),
  from: isoDate,
  changes: z.array(z.object({ on: isoDate, to: isoDate.nullable() })).max(30),
});

const tradespersonFields = {
  name: z.string({ error: "Who is it?" }).trim().min(1, "Who is it?").max(80, "Keep it under 80 characters"),
  trade: optionalText(60),
  phone: optionalText(40),
  email: z.preprocess(emptyToNull, z.email({ error: "That doesn't look like an email address" }).nullable()).optional(),
  notes: optionalText(2000),
  verdict: z.enum(VERDICTS).nullable().optional(),
};

export const tradespersonCreateSchema = z.object({ ...tradespersonFields, addedBy: z.string().trim().min(1).max(60) });
export const tradespersonUpdateSchema = z.object(tradespersonFields).partial();

export const readingCreateSchema = z.object({
  meter: z.enum(METERS),
  value: z.number({ error: "Enter the reading" }).min(0, "Can't be negative").max(1_000_000_000, "That looks too large"),
  takenOn: isoDate,
  takenBy: z.string().trim().min(1).max(60),
});

export const settingsUpdateSchema = z.object({
  budgetAvailable: z
    .number({ error: "Enter a number" })
    .min(-10_000_000)
    .max(100_000_000, "That looks too large")
    .optional(),
  // Added to whatever the pot holds on the server, so it can't overwrite a
  // change the other phone made in the meantime (Payday, and its undo).
  addToPot: z.number().min(-100_000_000).max(100_000_000).optional(),
  monthlySaving: money.optional(),
  movedInOn: isoDate.nullable().optional(),
  lastPaydayOn: isoDate.nullable().optional(),
  lastPaydayBy: optionalText(60),
  addMember: z.string().trim().min(1).max(60).optional(),
  removeMember: z.string().trim().min(1).max(60).optional(),
  bins: z.array(binSchema).max(BINS_MAX, `Up to ${BINS_MAX} bins`).optional(),
  meterDay: z.number().int().min(1).max(28).nullable().optional(),
});

const person = z.string().trim().min(1, "Who?").max(60);

const paymentFields = {
  description: z
    .string({ error: "What was it for?" })
    .trim()
    .min(1, "What was it for?")
    .max(DESCRIPTION_MAX, `Keep it under ${DESCRIPTION_MAX} characters`),
  amount: money.min(0.01, "Enter what's owed"),
  billTotal: optionalMoney,
  owedBy: person,
  owedTo: person,
  billedOn: isoDate,
};

const notOneself = (p: { owedBy?: string; owedTo?: string }) =>
  !p.owedBy || !p.owedTo || p.owedBy.toLowerCase() !== p.owedTo.toLowerCase();

// A share of a bill can't be more than the bill.
const withinBill = (p: { amount?: number; billTotal?: number | null }) =>
  p.amount == null || p.billTotal == null || p.amount <= p.billTotal;
const overBill = { message: "That's more than the whole bill", path: ["amount"] };

export const paymentCreateSchema = z
  .object({ ...paymentFields, itemId: z.string().min(1).max(40).nullable().optional(), addedBy: person })
  .refine(notOneself, { message: "Pick who owes whom", path: ["owedTo"] })
  .refine(withinBill, overBill);

export const paymentUpdateSchema = z
  .object({
    ...z.object(paymentFields).partial().shape,
    // Null: not paid after all.
    paidOn: isoDate.nullable().optional(),
    actor: person,
  })
  .refine(notOneself, { message: "Pick who owes whom", path: ["owedTo"] })
  .refine(withinBill, overBill);

/** Several ticked off at once as one settle-up, or (paidOn null) reopened. */
export const paymentSettleSchema = z.object({
  ids: z.array(z.string().min(1).max(40)).min(1, "Nothing to settle").max(500),
  paidOn: isoDate.nullable(),
  actor: person,
});

export const settlementUpdateSchema = z.object({ paidOn: isoDate });

const printLine = z.object({
  itemId: z.string().min(1).max(40),
  stepId: z.string().min(1).max(40).nullable().optional(),
  text: z.string().trim().min(1).max(300),
  group: z.string().trim().max(80).nullable().optional(),
});

export const printOutCreateSchema = z.object({
  title: z.string().trim().min(1).max(80),
  createdBy: z.string().trim().min(1).max(60),
  lines: z.array(printLine).min(1, "Nothing to print").max(400),
});

export type ItemCreateInput = z.input<typeof itemCreateSchema>;
export type ItemUpdateInput = z.input<typeof itemUpdateSchema>;
export type SettingsUpdateInput = z.input<typeof settingsUpdateSchema>;
export type PaymentCreateInput = z.input<typeof paymentCreateSchema>;
export type PaymentUpdateInput = z.input<typeof paymentUpdateSchema>;
export type TradespersonInput = z.input<typeof tradespersonUpdateSchema>;
