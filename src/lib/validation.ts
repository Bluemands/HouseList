import { z } from "zod";
import { KINDS, PRIORITIES, REPEATS, ROOMS, STATUSES, TITLE_MAX } from "@/lib/types";

const emptyToNull = (val: unknown) => (typeof val === "string" && val.trim() === "" ? null : val);

const money = z
  .number({ error: "Enter a number" })
  .min(0, "Can't be negative")
  .max(10_000_000, "That looks too large");

const optionalMoney = money.nullable().optional();

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a real date")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Use a real date");

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
});

export type ItemCreateInput = z.input<typeof itemCreateSchema>;
export type ItemUpdateInput = z.input<typeof itemUpdateSchema>;
export type SettingsUpdateInput = z.input<typeof settingsUpdateSchema>;
