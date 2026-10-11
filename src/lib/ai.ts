import { z } from "zod";
import type { Kind } from "@/lib/types";

// "Ask Claude": the app queues a question about an item, a worker on someone's
// own computer runs Claude Code with their subscription (scripts/ai-worker.mjs),
// and the answer comes back as a suggestion. Nothing here calls Claude.

export const AI_JOB_KINDS = ["RESEARCH_ITEM", "FIND_PRODUCT", "ASK"] as const;
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

/** One tap researches a job or finds a thing to buy; a question is its own kind. */
export function jobKindFor(itemKind: Kind, question?: string | null): AiJobKind {
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

export const aiJobCreateSchema = z.object({
  question: z
    .string()
    .trim()
    .max(QUESTION_MAX, `Keep it under ${QUESTION_MAX} characters`)
    .optional()
    .transform((q) => q || null),
  requestedBy: z.string().trim().min(1).max(60),
});

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
  status: AiJobStatus;
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

/**
 * Whether a worker is listening, from when it last asked for work. Workers
 * check in every minute or so while running, so a few minutes' silence means
 * the computer it's on is off or asleep.
 */
export function workerState(seenAt: string | null, now = Date.now()): "never" | "active" | "away" {
  if (!seenAt) return "never";
  return now - new Date(seenAt).getTime() < 5 * 60_000 ? "active" : "away";
}
