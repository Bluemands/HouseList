import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Item, Step } from "@/generated/prisma/client";
import type {
  commentCreateSchema,
  itemBulkCreateSchema,
  itemCreateSchema,
  itemUpdateSchema,
  quoteCreateSchema,
  quoteUpdateSchema,
} from "@/lib/validation";
import { ITEM_INCLUDE, estimateFromSteps, fromDay, getSettings, isMember, stepRows, toItemDTO } from "@/lib/data";
import { nextOccurrence, type ItemDTO } from "@/lib/types";
import { settlePot } from "@/lib/pot";
import { today as ukToday } from "@/lib/format";

// The rules every write follows, whoever makes it: the app's own API routes
// and the Claude connector (src/lib/mcp) both come through here, so the pot,
// repeating jobs and step estimates can't drift apart between them.

type ItemCreate = z.output<typeof itemCreateSchema>;
type ItemBulkCreate = z.output<typeof itemBulkCreateSchema>;
type ItemUpdate = z.output<typeof itemUpdateSchema>;
type StepIn = NonNullable<ItemCreate["steps"]>[number];

type WriteOptions = {
  /**
   * Whether a new name in addedBy joins the household (the "who's this?"
   * list). True for the people using the app; false for Claude, which
   * shouldn't turn up as someone to assign jobs to.
   */
  addMember?: boolean;
};

/** Pushes the name onto the household unless it's already there (or shouldn't be). */
function memberPush(members: string[], name: string, { addMember = true }: WriteOptions) {
  return !addMember || isMember(members, name) ? undefined : { push: name };
}

export async function createItem(input: ItemCreate, options: WriteOptions = {}): Promise<ItemDTO> {
  const { steps, dueDate, warrantyUntil, ...fields } = input;
  const data = { ...fields, ...estimateFromSteps(steps) };
  const done = data.status === "DONE";
  const actualPrice = done ? (data.actualPrice ?? data.estimatedPrice ?? null) : (data.actualPrice ?? null);

  const settings = await getSettings();
  // Logging something already bought spends it from the pot, once there is one.
  const pot = settlePot(
    { status: "TODO", potCharge: null, steps: [] },
    { status: done ? "DONE" : "TODO", actualPrice, steps },
    settings.potTracked,
  );
  const now = new Date();
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.item.create({
      data: {
        ...data,
        actualPrice,
        potCharge: pot.itemCharge,
        dueDate: fromDay(dueDate),
        warrantyUntil: fromDay(warrantyUntil),
        completedAt: done ? new Date() : null,
        completedBy: done ? data.addedBy : null,
        steps: steps?.length
          ? {
              create: stepRows(steps).map((row, i) => ({
                ...row,
                potCharge: pot.stepCharges![i],
                doneAt: row.done ? now : null,
              })),
            }
          : undefined,
      },
      include: ITEM_INCLUDE,
    });
    await tx.settings.update({
      where: { id: 1 },
      data: {
        budgetAvailable: pot.delta ? { increment: pot.delta } : undefined,
        members: memberPush(settings.members, data.addedBy, options),
      },
    });
    return created;
  });
  return toItemDTO(item);
}

/** Many items at once: a pasted list, the new-home essentials, or Claude's research. */
export async function createItems({ addedBy, items }: ItemBulkCreate, options: WriteOptions = {}): Promise<ItemDTO[]> {
  const settings = await getSettings();
  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const out = [];
    let potDelta = 0;
    // Oldest-first timestamps keep the list in the order it was written.
    const base = Date.now() - items.length;
    for (const [index, { steps, dueDate, warrantyUntil, ...data }] of items.entries()) {
      // Stages already paid ("Deposit £200", ticked) spend from the pot, as
      // they do when an item is added on its own.
      const pot = settlePot(
        { status: "TODO", potCharge: null, steps: [] },
        { status: "TODO", actualPrice: null, steps },
        settings.potTracked,
      );
      potDelta += pot.delta;
      out.push(
        await tx.item.create({
          data: {
            ...data,
            ...estimateFromSteps(steps),
            status: data.status === "DONE" ? "TODO" : data.status,
            addedBy,
            dueDate: fromDay(dueDate),
            warrantyUntil: fromDay(warrantyUntil),
            createdAt: new Date(base + index),
            steps: steps?.length
              ? {
                  create: stepRows(steps).map((row, i) => ({
                    ...row,
                    potCharge: pot.stepCharges![i],
                    doneAt: row.done ? now : null,
                  })),
                }
              : undefined,
          },
          include: ITEM_INCLUDE,
        }),
      );
    }
    const push = memberPush(settings.members, addedBy, options);
    if (push || potDelta) {
      await tx.settings.update({
        where: { id: 1 },
        data: { budgetAvailable: potDelta ? { increment: potDelta } : undefined, members: push },
      });
    }
    return out;
  });
  return created.map(toItemDTO);
}

/**
 * The full step list a change asks for, or undefined when the steps aren't
 * changing. `current` is the steps as they are on the server, in order.
 */
export function nextSteps(
  current: Pick<Step, "id" | "text" | "done" | "cost" | "link" | "notes">[],
  change: { steps?: StepIn[]; stepDone?: { id: string; done: boolean }; appendSteps?: StepIn[] },
): StepIn[] | undefined {
  if (change.steps) return change.steps;
  const kept = (done: (s: { id: string; done: boolean }) => boolean) =>
    current.map(({ id, text, cost, link, notes, ...s }) => ({ id, text, done: done({ id, ...s }), cost, link, notes }));
  if (change.stepDone) {
    const { id: tickedId, done } = change.stepDone;
    return kept((s) => (s.id === tickedId ? done : s.done));
  }
  // Added after whatever's there now, so they can't undo a tick made meanwhile.
  if (change.appendSteps?.length) return [...kept((s) => s.done), ...change.appendSteps];
  return undefined;
}

/**
 * What the item cost once a change lands. Ticking something off assumes it
 * cost what you guessed; the toast offers a one-tap way to correct it.
 * Reopening it forgets that guess, so the next finish uses the estimate as it
 * is then.
 */
export function nextActualPrice(
  existing: Pick<Item, "status" | "actualPrice" | "estimatedPrice">,
  changes: { status?: Item["status"]; actualPrice?: number | null; estimatedPrice?: number | null },
): number | null {
  const status = changes.status ?? existing.status;
  const completing = status === "DONE" && existing.status !== "DONE";
  const reopening = status !== "DONE" && existing.status === "DONE";
  let actualPrice = changes.actualPrice !== undefined ? changes.actualPrice : existing.actualPrice;
  if (completing && actualPrice == null) {
    actualPrice = changes.estimatedPrice !== undefined ? changes.estimatedPrice : existing.estimatedPrice;
  }
  if (reopening && changes.actualPrice === undefined) actualPrice = null;
  return actualPrice ?? null;
}

/** The next round of a repeating job, counted from the day this one was done. */
export function nextRound(done: Item & { steps: Step[] }, today = ukToday()) {
  return {
    title: done.title,
    kind: done.kind,
    room: done.room,
    priority: done.priority,
    estimatedPrice: done.estimatedPrice,
    estimateMax: done.estimateMax,
    assignee: done.assignee,
    project: done.project,
    links: done.links,
    notes: done.notes,
    repeat: done.repeat,
    addedBy: done.addedBy,
    spawnedFromId: done.id,
    dueDate: done.repeat ? fromDay(nextOccurrence(today, done.repeat)) : null,
    steps: done.steps.length
      ? {
          create: done.steps.map(({ text, position, cost, link, notes }) => ({
            text,
            done: false,
            position,
            cost,
            link,
            notes,
          })),
        }
      : undefined,
  };
}

export type ItemUpdateResult = {
  item: ItemDTO;
  potDelta: number;
  spawned: ItemDTO | null;
  removedIds: string[];
};

/**
 * A partial change to one item; null if it's gone. `appendSteps` adds steps
 * after the current ones (applied under the row lock, like `stepDone`).
 */
export async function updateItem(
  id: string,
  input: ItemUpdate,
  { appendSteps }: { appendSteps?: StepIn[] } = {},
): Promise<ItemUpdateResult | null> {
  const { steps: stepsIn, stepDone, dueDate, warrantyUntil, actor, ...fields } = input;

  const settings = await getSettings();
  const result = await prisma.$transaction(async (tx) => {
    // One change to an item at a time: two phones ticking at once must each
    // see the other's result, or both would spend from the same starting point.
    await tx.$queryRaw`SELECT "id" FROM "Item" WHERE "id" = ${id} FOR UPDATE`;
    const existing = await tx.item.findUnique({ where: { id }, include: { steps: true } });
    if (!existing) return null;

    const current = [...existing.steps].sort((a, b) => a.position - b.position);
    const steps = nextSteps(current, { steps: stepsIn, stepDone, appendSteps });
    const changes = { ...fields, ...estimateFromSteps(steps, existing.steps) };
    const status = changes.status ?? existing.status;
    const completing = status === "DONE" && existing.status !== "DONE";
    const reopening = status !== "DONE" && existing.status === "DONE";
    const actualPrice = nextActualPrice(existing, changes);

    // The pot is real money: stages and finished items leave it, and come back
    // if they're reopened or their price is corrected (see lib/pot).
    const pot = settlePot(existing, { status, actualPrice, steps }, settings.potTracked);
    const potDelta = pot.delta;
    const now = new Date();

    if (steps) {
      const keep = steps.flatMap((s) => (s.id ? [s.id] : []));
      await tx.step.deleteMany({ where: { itemId: id, id: { notIn: keep } } });
      for (const [position, row] of stepRows(steps).entries()) {
        const stepId = steps[position].id;
        const before = existing.steps.find((s) => s.id === stepId);
        const data = {
          ...row,
          potCharge: pot.stepCharges![position],
          doneAt: row.done ? (before?.done ? before.doneAt : now) : null,
        };
        if (stepId) {
          await tx.step.updateMany({ where: { id: stepId, itemId: id }, data });
        } else {
          await tx.step.create({ data: { ...data, itemId: id } });
        }
      }
    }

    const updated = await tx.item.update({
      where: { id },
      data: {
        ...changes,
        actualPrice,
        potCharge: pot.itemCharge,
        dueDate: fromDay(dueDate),
        warrantyUntil: fromDay(warrantyUntil),
        ...(completing ? { completedAt: new Date(), completedBy: actor || null } : {}),
        ...(reopening ? { completedAt: null, completedBy: null } : {}),
      },
      include: ITEM_INCLUDE,
    });

    if (potDelta !== 0) {
      await tx.settings.update({ where: { id: 1 }, data: { budgetAvailable: { increment: potDelta } } });
    }

    // A repeating job comes round again.
    const spawned =
      completing && updated.repeat ? await tx.item.create({ data: nextRound(updated), include: ITEM_INCLUDE }) : null;

    // Reopening it (usually an undo) takes back the one it scheduled.
    let removedIds: string[] = [];
    if (reopening) {
      const next = await tx.item.findMany({ where: { spawnedFromId: id, status: { not: "DONE" } }, select: { id: true } });
      removedIds = next.map((n) => n.id);
      if (removedIds.length) await tx.item.deleteMany({ where: { id: { in: removedIds } } });
    }

    return { updated, spawned, removedIds, potDelta };
  });
  if (!result) return null;

  return {
    item: toItemDTO(result.updated),
    potDelta: result.potDelta,
    spawned: result.spawned ? toItemDTO(result.spawned) : null,
    removedIds: result.removedIds,
  };
}

export async function deleteItem(id: string) {
  // deleteMany so a double delete (both of you at once, or an undo race) is a no-op.
  const { count } = await prisma.item.deleteMany({ where: { id } });
  return count > 0;
}

/** The whole item, or null if someone else deleted it. */
export async function getItem(id: string): Promise<ItemDTO | null> {
  const item = await prisma.item.findUnique({ where: { id }, include: ITEM_INCLUDE });
  return item ? toItemDTO(item) : null;
}

/** Logs a quote against an item; returns the quote's id, or null if the item's gone. */
export async function addQuote(itemId: string, data: z.output<typeof quoteCreateSchema>) {
  const exists = await prisma.item.count({ where: { id: itemId } });
  if (!exists) return null;
  const quote = await prisma.quote.create({ data: { ...data, note: data.note ?? null, itemId } });
  return quote.id;
}

/** Edits, chooses or unchooses a quote; returns its item's id, or null if the quote's gone. */
export async function updateQuote(id: string, data: z.output<typeof quoteUpdateSchema>) {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return null;

  await prisma.$transaction(async (tx) => {
    const updated = await tx.quote.update({ where: { id }, data });
    if (data.chosen) {
      // One chosen quote per item, and choosing it fixes the item's cost.
      await tx.quote.updateMany({ where: { itemId: quote.itemId, id: { not: id } }, data: { chosen: false } });
      await tx.item.update({
        where: { id: quote.itemId },
        data: { estimatedPrice: updated.amount, estimateMax: null, isQuote: true },
      });
    } else if (data.chosen === false && quote.chosen) {
      // Unchoosing keeps the cost as it was, but it's no longer a firm quote.
      await tx.item.update({ where: { id: quote.itemId }, data: { isQuote: false } });
    } else if (updated.chosen && data.amount !== undefined) {
      await tx.item.update({ where: { id: quote.itemId }, data: { estimatedPrice: updated.amount } });
    }
  });
  return quote.itemId;
}

/** Posts an update on an item; false if the item's gone. */
export async function addComment(itemId: string, data: z.output<typeof commentCreateSchema>) {
  const exists = await prisma.item.count({ where: { id: itemId } });
  if (!exists) return false;
  await prisma.comment.create({ data: { ...data, itemId } });
  return true;
}
