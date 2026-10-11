import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemUpdateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { ITEM_INCLUDE, estimateFromSteps, fromDay, getSettings, stepRows, toItemDTO } from "@/lib/data";
import { nextOccurrence } from "@/lib/types";
import { settlePot } from "@/lib/pot";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  const body = await readBody(request, itemUpdateSchema);
  if ("error" in body) return body.error;
  const { steps: stepsIn, stepDone, dueDate, warrantyUntil, actor, ...fields } = body.data;

  const settings = await getSettings();
  const result = await prisma.$transaction(async (tx) => {
    // One change to an item at a time: two phones ticking at once must each
    // see the other's result, or both would spend from the same starting point.
    await tx.$queryRaw`SELECT "id" FROM "Item" WHERE "id" = ${id} FOR UPDATE`;
    const existing = await tx.item.findUnique({ where: { id }, include: { steps: true } });
    if (!existing) return null;

    const current = [...existing.steps].sort((a, b) => a.position - b.position);
    const steps =
      stepsIn ??
      (stepDone
        ? current.map(({ id: stepId, text, done, cost, link, notes }) => ({
            id: stepId,
            text,
            done: stepId === stepDone.id ? stepDone.done : done,
            cost,
            link,
            notes,
          }))
        : undefined);
    const changes = { ...fields, ...estimateFromSteps(steps, existing.steps) };
    const status = changes.status ?? existing.status;
    const completing = status === "DONE" && existing.status !== "DONE";
    const reopening = status !== "DONE" && existing.status === "DONE";

    let actualPrice = changes.actualPrice !== undefined ? changes.actualPrice : existing.actualPrice;
    // Ticking something off assumes it cost what you guessed; the toast offers
    // a one-tap way to correct it. Reopening it forgets that guess, so the
    // next finish uses the estimate as it is then.
    if (completing && actualPrice == null) {
      actualPrice = changes.estimatedPrice !== undefined ? changes.estimatedPrice : existing.estimatedPrice;
    }
    if (reopening && changes.actualPrice === undefined) actualPrice = null;

    // The pot is real money: stages and finished items leave it, and come back
    // if they're reopened or their price is corrected (see lib/pot).
    const pot = settlePot(existing, { status, actualPrice: actualPrice ?? null, steps }, settings.potTracked);
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

    // A repeating job comes round again, counted from the day it was done.
    let spawned = null;
    if (completing && updated.repeat) {
      spawned = await tx.item.create({
        data: {
          title: updated.title,
          kind: updated.kind,
          room: updated.room,
          priority: updated.priority,
          estimatedPrice: updated.estimatedPrice,
          estimateMax: updated.estimateMax,
          assignee: updated.assignee,
          project: updated.project,
          links: updated.links,
          notes: updated.notes,
          repeat: updated.repeat,
          addedBy: updated.addedBy,
          spawnedFromId: updated.id,
          dueDate: fromDay(nextOccurrence(new Date().toISOString().slice(0, 10), updated.repeat)),
          steps: updated.steps.length
            ? {
                create: updated.steps.map(({ text, position, cost, link, notes }) => ({
                  text,
                  done: false,
                  position,
                  cost,
                  link,
                  notes,
                })),
              }
            : undefined,
        },
        include: ITEM_INCLUDE,
      });
    }

    // Reopening it (usually an undo) takes back the one it scheduled.
    let removedIds: string[] = [];
    if (reopening) {
      const next = await tx.item.findMany({ where: { spawnedFromId: id, status: { not: "DONE" } }, select: { id: true } });
      removedIds = next.map((n) => n.id);
      if (removedIds.length) await tx.item.deleteMany({ where: { id: { in: removedIds } } });
    }

    return { updated, spawned, removedIds, potDelta };
  });
  if (!result) return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });

  return NextResponse.json({
    item: toItemDTO(result.updated),
    potDelta: result.potDelta,
    spawned: result.spawned ? toItemDTO(result.spawned) : null,
    removedIds: result.removedIds,
  });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  // deleteMany so a double delete (both of you at once, or an undo race) is a no-op.
  await prisma.item.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
