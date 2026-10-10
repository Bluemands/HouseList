import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemUpdateSchema } from "@/lib/validation";
import { ITEM_INCLUDE, fromDay, getSettings, toItemDTO } from "@/lib/data";
import { nextOccurrence } from "@/lib/types";

const spentBy = (status: string, actualPrice: number | null) => (status === "DONE" ? (actualPrice ?? 0) : 0);

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = itemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const existing = await prisma.item.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
  }

  const { steps, dueDate, actor, ...changes } = parsed.data;
  const status = changes.status ?? existing.status;
  const completing = status === "DONE" && existing.status !== "DONE";
  const reopening = status !== "DONE" && existing.status === "DONE";

  let actualPrice = changes.actualPrice !== undefined ? changes.actualPrice : existing.actualPrice;
  // Ticking something off assumes it cost what you guessed; the toast offers
  // a one-tap way to correct it.
  if (completing && actualPrice == null) {
    actualPrice = changes.estimatedPrice !== undefined ? changes.estimatedPrice : existing.estimatedPrice;
  }

  // The pot is real money: whatever an item costs leaves it when the item is
  // done, and comes back if it's reopened or its price is corrected.
  const potDelta = spentBy(existing.status, existing.actualPrice) - spentBy(status, actualPrice ?? null);

  await getSettings();
  const result = await prisma.$transaction(async (tx) => {
    if (steps) {
      const keep = steps.flatMap((s) => (s.id ? [s.id] : []));
      await tx.step.deleteMany({ where: { itemId: id, id: { notIn: keep } } });
      for (const [position, step] of steps.entries()) {
        if (step.id) {
          await tx.step.updateMany({
            where: { id: step.id, itemId: id },
            data: { text: step.text, done: step.done ?? false, position },
          });
        } else {
          await tx.step.create({ data: { itemId: id, text: step.text, done: step.done ?? false, position } });
        }
      }
    }

    const updated = await tx.item.update({
      where: { id },
      data: {
        ...changes,
        actualPrice,
        dueDate: fromDay(dueDate),
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
          link: updated.link,
          notes: updated.notes,
          repeat: updated.repeat,
          addedBy: updated.addedBy,
          spawnedFromId: updated.id,
          dueDate: fromDay(nextOccurrence(new Date().toISOString().slice(0, 10), updated.repeat)),
          steps: updated.steps.length
            ? { create: updated.steps.map((s) => ({ text: s.text, done: false, position: s.position })) }
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

    return { updated, spawned, removedIds };
  });

  return NextResponse.json({
    item: toItemDTO(result.updated),
    potDelta,
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
