import { z } from "zod";
import { PRIORITIES, ROOMS, STATUSES } from "@/lib/types";

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

const price = z
  .number({ error: "Enter a valid number" })
  .positive("Price must be greater than 0")
  .max(10_000_000, "That price looks too large");

const optionalPrice = z.preprocess(
  emptyToUndefined,
  z
    .number({ error: "Enter a valid number" })
    .positive("Price must be greater than 0")
    .max(10_000_000, "That price looks too large")
    .optional(),
);

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z.url({ error: "Enter a valid URL, e.g. https://example.com" }).optional(),
);

const optionalText = z.preprocess(
  emptyToUndefined,
  z.string().max(2000, "Keep it under 2000 characters").optional(),
);

export const itemCreateSchema = z.object({
  title: z
    .string({ error: "Title is required" })
    .trim()
    .min(1, "Title is required")
    .max(200, "Keep the title under 200 characters"),
  room: z.enum(ROOMS, { error: "Choose a room" }),
  estimatedPrice: price,
  priority: z.enum(PRIORITIES, { error: "Choose a priority" }),
  link: optionalUrl,
  notes: optionalText,
  addedBy: z
    .string({ error: "Missing name" })
    .trim()
    .min(1, "Missing name")
    .max(80),
});

export const itemUpdateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Keep the title under 200 characters")
    .optional(),
  room: z.enum(ROOMS).optional(),
  estimatedPrice: price.optional(),
  actualPrice: optionalPrice.nullable(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(STATUSES).optional(),
  link: optionalUrl.nullable(),
  notes: optionalText.nullable(),
  addedBy: z.string().trim().min(1, "Missing name").max(80).optional(),
});

export const settingsUpdateSchema = z.object({
  budgetAvailable: z
    .number({ error: "Enter a valid number" })
    .min(0, "Budget can't be negative")
    .max(100_000_000, "That number looks too large"),
});
