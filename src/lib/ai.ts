import { z } from "zod";
import type { Kind } from "@/lib/types";
import { formatGBP } from "@/lib/format";

// Kept apart so the app can use it without loading zod.
export { workerState } from "@/lib/worker-state";

// "Ask Claude": the app queues a question about an item, a worker on someone's
// own computer runs Claude Code with their subscription (scripts/ai-worker.mjs),
// and the answer comes back as a suggestion. Nothing here calls Claude.

export const AI_JOB_KINDS = ["RESEARCH_ITEM", "FIND_PRODUCT", "ASK", "IMPROVE"] as const;
export type AiJobKind = (typeof AI_JOB_KINDS)[number];

export const AI_JOB_STATUSES = ["QUEUED", "RUNNING", "DONE", "FAILED", "ACCEPTED", "DISMISSED"] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

/** Jobs the app still shows: waiting, working, or with an answer to deal with. */
export const OPEN_JOB_STATUSES = ["QUEUED", "RUNNING", "DONE", "FAILED"] as const satisfies readonly AiJobStatus[];

export const QUESTION_MAX = 500;

/** A claim older than this is a worker that died mid-job. */
export const STALE_CLAIM_MS = 10 * 60_000;
/** Claims before a job that keeps killing its worker is given up on. */
export const MAX_ATTEMPTS = 3;

/**
 * One tap researches a job or finds a thing to buy; a question is its own
 * kind, and so is asking Claude to improve the item in place.
 */
export function jobKindFor(itemKind: Kind, question?: string | null, improve = false): AiJobKind {
  if (improve) return "IMPROVE";
  if (question?.trim()) return "ASK";
  return itemKind === "BUY" ? "FIND_PRODUCT" : "RESEARCH_ITEM";
}

// ---- The suggestion. Claude's answer is clipped to fit rather than refused
// over a long line, but anything that isn't a real web link is dropped. ----

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.slice(0, max));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .transform((s) => s.slice(0, max) || undefined)
    .optional();

const list = <T extends z.ZodType>(item: T, max: number) => z.array(item).transform((a) => a.slice(0, max));

const price = z.number().min(0).max(10_000_000);

const webUrl = z
  .url()
  .max(2000)
  .refine((u) => /^https?:\/\//i.test(u), "Links must be web addresses");

export const aiResultSchema = z.object({
  summary: text(1500),
  estimate: z
    .object({ min: price, max: price })
    .transform((e) => (e.max < e.min ? { min: e.max, max: e.min } : e))
    .optional(),
  diy: z.enum(["yes", "with-care", "no"]).optional(),
  steps: list(
    z.object({
      text: text(200),
      cost: price.optional(),
      link: webUrl.optional(),
      notes: optionalText(1000),
    }),
    20,
  ).optional(),
  links: list(z.object({ title: text(200), url: webUrl }), 10).optional(),
  options: list(
    z.object({
      title: text(200),
      price: price.optional(),
      url: webUrl.optional(),
      retailer: optionalText(80),
    }),
    8,
  ).optional(),
  cautions: list(text(400), 8).optional(),
});

export type AiResult = z.output<typeof aiResultSchema>;

/** What a worker sends back: the answer, or why there isn't one. */
export const workerSubmitSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.string().trim().min(1).transform((s) => s.slice(0, 2000)) }),
]);

export const aiJobCreateSchema = z
  .object({
    question: z
      .string()
      .trim()
      .max(QUESTION_MAX, `Keep it under ${QUESTION_MAX} characters`)
      // The app sends null for "no question" (one tap, or quick add's sparkle).
      .nullish()
      .transform((q) => q || null),
    requestedBy: z.string().trim().min(1).max(60),
    autofill: z.boolean().optional().default(false),
    // Improve with Claude: the question is what they want improved.
    improve: z.boolean().optional().default(false),
  })
  .refine((b) => !b.improve || b.question, { message: "Say what to improve first", path: ["question"] });

/** Used (accepted), dismissed, sent round again, or (undoing a dismiss) back. */
export const aiJobUpdateSchema = z.object({
  status: z.enum(["ACCEPTED", "DISMISSED", "QUEUED", "DONE"]),
});
export type AiJobUpdate = z.infer<typeof aiJobUpdateSchema>["status"];

/** Which statuses each change can come from, so a late tap can't undo another. */
export const JOB_TRANSITIONS: Record<AiJobUpdate, AiJobStatus[]> = {
  ACCEPTED: ["DONE"],
  DISMISSED: ["QUEUED", "RUNNING", "DONE", "FAILED", "ACCEPTED"],
  QUEUED: ["FAILED"],
  // Only an answered job: the route also checks it finished without an error.
  DONE: ["DISMISSED", "ACCEPTED"],
};

export type AiJobDTO = {
  id: string;
  itemId: string | null;
  kind: AiJobKind;
  question: string | null;
  autofill: boolean;
  status: AiJobStatus;
  /** An IMPROVE job whose changes are on the item, and can be undone. */
  applied: boolean;
  result: AiResult | null;
  error: string | null;
  requestedBy: string;
  claimedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

/**
 * A RUNNING job whose worker has gone quiet: hand it out again, or give up
 * once it has used its attempts (it's probably what keeps killing the worker).
 */
export function staleOutcome(
  job: { status: AiJobStatus; claimedAt: Date | null; attempts: number },
  now: Date,
): "requeue" | "fail" | null {
  if (job.status !== "RUNNING" || !job.claimedAt) return null;
  if (now.getTime() - job.claimedAt.getTime() < STALE_CLAIM_MS) return null;
  return job.attempts >= MAX_ATTEMPTS ? "fail" : "requeue";
}

const NOTES_MAX = 4000;
const LINKS_MAX = 20;
const DIY_LABELS = { yes: "Fine to DIY.", "with-care": "DIY with care.", no: "One for a tradesperson." } as const;

/**
 * Claude's answer as plain text, short enough to read on a phone: the answer,
 * the options, then at most three things to watch, whatever came back.
 */
export function claudeNote(result: AiResult, lead: string) {
  return [
    [lead, result.summary, result.diy ? DIY_LABELS[result.diy] : null].filter(Boolean).join(" "),
    result.options?.length
      ? `Options:\n${result.options
          .map((o) => `• ${o.title}${o.price != null ? ` — ${formatGBP(o.price)}` : ""}${o.retailer ? ` (${o.retailer})` : ""}`)
          .join("\n")}`
      : null,
    result.cautions?.length ? `Watch out for:\n${result.cautions.slice(0, 3).map((c) => `• ${c}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** A cost range from the answer: its estimate, or the spread of its options' prices. */
function answerRange(result: AiResult) {
  const priced = (result.options ?? []).flatMap((o) => (o.price == null ? [] : [o.price]));
  return result.estimate ?? (priced.length ? { min: Math.min(...priced), max: Math.max(...priced) } : null);
}

/** The item's links plus any new ones from the answer (its links, then its options'). */
function withFoundLinks(links: string[], result: AiResult) {
  const found = [...(result.links ?? []).map((l) => l.url), ...(result.options ?? []).flatMap((o) => (o.url ? [o.url] : []))];
  return [...new Set([...links, ...found])].slice(0, LINKS_MAX);
}

/**
 * What an answer fills in on an item added with "Ask Claude": only what's
 * empty, so nothing typed is overwritten. Costs, steps and links go where
 * they belong; the rest (summary, options, cautions) is added to the notes.
 */
export function autofillChanges(
  item: { estimatedPrice: number | null; steps: unknown[]; links: string[]; notes: string | null },
  result: AiResult,
) {
  const range = answerRange(result);
  const estimate =
    item.estimatedPrice == null && range
      ? { estimatedPrice: range.min, estimateMax: range.max > range.min ? range.max : null }
      : {};

  // Costed steps set the item's estimate to their total (an app rule), so
  // they keep their costs only when there's no figure of the user's to lose.
  const appendSteps = item.steps.length
    ? []
    : (result.steps ?? []).map((s) => ({
        text: s.text,
        cost: item.estimatedPrice == null ? (s.cost ?? null) : null,
        link: s.link ?? null,
        notes: s.notes ?? null,
      }));

  const links = withFoundLinks(item.links, result);

  const block = claudeNote(result, "From Claude:");
  const notes = (item.notes?.trim() ? `${item.notes.trim()}\n\n${block}` : block).slice(0, NOTES_MAX);

  return {
    changes: { ...estimate, notes, ...(links.length !== item.links.length ? { links } : {}) },
    appendSteps,
  };
}

// ---- Improve with Claude: the answer revises the item in place. ----

type ItemStep = { id: string; text: string; done: boolean; cost: number | null; link: string | null; notes: string | null };
type StepIn = { id?: string; text: string; done: boolean; cost: number | null; link: string | null; notes: string | null };
type ImprovableItem = {
  estimatedPrice: number | null;
  estimateMax: number | null;
  isQuote: boolean;
  links: string[];
  steps: ItemStep[];
};

const STEPS_MAX = 50;
const stepIn = ({ id, text, done, cost, link, notes }: ItemStep): StepIn => ({ id, text, done, cost, link, notes });

/**
 * What an improvement changes on an item. Claude's steps replace the ones
 * still to do (ticked ones are real progress, and may have been paid for, so
 * they stay); its estimate replaces the item's unless that's a firm quote, in
 * which case its steps come without costs so the step-total rule can't
 * replace the quote either. New links are added. Notes are left alone: the
 * answer itself is posted as an update.
 */
export function improveChanges(item: ImprovableItem, result: AiResult) {
  const range = answerRange(result);
  const estimate =
    !item.isQuote && range ? { estimatedPrice: range.min, estimateMax: range.max > range.min ? range.max : null } : {};
  const steps = result.steps?.length
    ? [
        ...item.steps.filter((s) => s.done).map(stepIn),
        ...result.steps.map((s) => ({
          text: s.text,
          done: false,
          cost: item.isQuote ? null : (s.cost ?? null),
          link: s.link ?? null,
          notes: s.notes ?? null,
        })),
      ].slice(0, STEPS_MAX)
    : undefined;
  const links = withFoundLinks(item.links, result);
  const addedLinks = links.filter((l) => !item.links.includes(l));
  return {
    changes: { ...estimate, ...(steps ? { steps } : {}), ...(addedLinks.length ? { links } : {}) },
    addedLinks,
  };
}

const undoStep = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
  cost: z.number().nullable(),
  link: z.string().nullable(),
  notes: z.string().nullable(),
});

/** What an applied improvement keeps so it can be undone. */
export const improveUndoSchema = z.object({
  before: z.object({
    estimatedPrice: z.number().nullable(),
    estimateMax: z.number().nullable(),
    /** Null: the steps weren't changed. */
    steps: z.array(undoStep).nullable(),
  }),
  /** The estimate as Claude left it: only put back if nobody's changed it since. */
  after: z.object({ estimatedPrice: z.number().nullable(), estimateMax: z.number().nullable() }),
  addedLinks: z.array(z.string()),
  /** The update Claude posted with its answer. */
  commentId: z.string().nullable(),
});
export type ImproveUndo = z.infer<typeof improveUndoSchema>;

/**
 * Taking an improvement back, from the item as it is now. Anything someone
 * has done since is kept: a step ticked off (even one of Claude's) stays, as
 * does an estimate set by hand or a quote chosen. The rest goes back to how
 * it was.
 */
export function undoImproveChanges(item: ImprovableItem, undo: ImproveUndo) {
  const changes: { estimatedPrice?: number | null; estimateMax?: number | null; links?: string[]; steps?: StepIn[] } = {};

  if (undo.before.steps) {
    const now = new Map(item.steps.map((s) => [s.id, s]));
    const before = new Set(undo.before.steps.map((s) => s.id));
    changes.steps = [
      // As they were, keeping any tick made since; ones Claude replaced come back.
      ...undo.before.steps.map((s) => {
        const current = now.get(s.id);
        return current ? stepIn(current) : { text: s.text, done: s.done, cost: s.cost, link: s.link, notes: s.notes };
      }),
      // Claude's own steps go, unless someone has ticked one off since.
      ...item.steps.filter((s) => !before.has(s.id) && s.done).map(stepIn),
    ].slice(0, STEPS_MAX);
  }

  if (!item.isQuote && item.estimatedPrice === undo.after.estimatedPrice && item.estimateMax === undo.after.estimateMax) {
    changes.estimatedPrice = undo.before.estimatedPrice;
    changes.estimateMax = undo.before.estimateMax;
  }

  const added = new Set(undo.addedLinks);
  const links = item.links.filter((l) => !added.has(l));
  if (links.length !== item.links.length) changes.links = links;
  return changes;
}
