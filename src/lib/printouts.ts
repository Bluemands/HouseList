import { z } from "zod";
import type { ItemDTO } from "@/lib/types";

/**
 * Printed checklists. A print-out keeps its lines exactly as they went on
 * paper: which item (and step) each was, its words, and the heading it sat
 * under. Ticking it back later shows the same list, numbered the same, and
 * says what's changed since.
 */

export type PrintLine = {
  itemId: string;
  /** Set for a step of a job, printed under it. */
  stepId?: string | null;
  text: string;
  /** The heading it was printed under, if any. */
  group?: string | null;
};

export type PrintOutDTO = {
  id: string;
  title: string;
  createdBy: string;
  createdAt: string;
  lines: PrintLine[];
};

export type PrintOutSummary = Omit<PrintOutDTO, "lines"> & { count: number };

/** How long a print-out can still be ticked back in. */
export const PRINT_OUT_DAYS = 30;
const MAX_LINES = 400;

const lineSchema = z.object({
  itemId: z.string().min(1).max(40),
  stepId: z.string().min(1).max(40).nullable().optional(),
  text: z.string().trim().min(1).max(300),
  group: z.string().trim().max(80).nullable().optional(),
});

export const printOutCreateSchema = z.object({
  title: z.string().trim().min(1).max(80),
  createdBy: z.string().trim().min(1).max(60),
  lines: z.array(lineSchema).min(1, "Nothing to print").max(MAX_LINES),
});

/**
 * An item and, under it, its steps still to do. A finished item isn't printed;
 * nor are its steps already ticked.
 */
export function itemLines(item: ItemDTO, group?: string | null): PrintLine[] {
  if (item.status === "DONE") return [];
  return [
    { itemId: item.id, text: item.title, group: group ?? null },
    ...item.steps
      .filter((s) => !s.done)
      .map((s) => ({ itemId: item.id, stepId: s.id, text: s.text, group: group ?? null })),
  ];
}

/** Several items, each under its heading, in the order given. */
export function listLines(groups: { label: string | null; items: ItemDTO[] }[]): PrintLine[] {
  return groups.flatMap((g) => g.items.flatMap((item) => itemLines(item, g.label)));
}

/** Just a job's steps still to do, for printing one job. */
export function stepLines(item: ItemDTO): PrintLine[] {
  return item.steps.filter((s) => !s.done).map((s) => ({ itemId: item.id, stepId: s.id, text: s.text }));
}

/**
 * The number each line carries on paper and when ticking back: jobs and
 * things are 1, 2, 3…; a step printed under its job takes the job's number
 * and a letter (2a, 2b), so the list reads as it does on the page. Steps
 * printed on their own (one job's steps) are just numbered.
 */
export function lineLabels(lines: PrintLine[]): string[] {
  let n = 0;
  let parent: { itemId: string; n: number; steps: number } | null = null;
  return lines.map((line) => {
    if (line.stepId && parent?.itemId === line.itemId) {
      parent.steps += 1;
      return `${parent.n}${String.fromCharCode(96 + Math.min(parent.steps, 26))}`;
    }
    n += 1;
    parent = line.stepId ? null : { itemId: line.itemId, n, steps: 0 };
    return String(n);
  });
}

export type LineState =
  | { kind: "open" }
  | { kind: "done"; by: string | null }
  /** Deleted since, or the step was taken off. */
  | { kind: "gone" };

/** Where a printed line stands now. */
export function lineState(line: PrintLine, itemById: ReadonlyMap<string, ItemDTO>): LineState {
  const item = itemById.get(line.itemId);
  if (!item) return { kind: "gone" };
  if (!line.stepId) return item.status === "DONE" ? { kind: "done", by: item.completedBy } : { kind: "open" };
  const step = item.steps.find((s) => s.id === line.stepId);
  if (!step) return { kind: "gone" };
  // A step of a finished job is as good as done.
  if (step.done || item.status === "DONE") return { kind: "done", by: null };
  return { kind: "open" };
}

/** "/?printout=…": the app opens that print-out to tick off. */
export const printOutUrl = (id: string) => `/?printout=${encodeURIComponent(id)}`;
