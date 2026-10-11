import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemCreateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { settlePot } from "@/lib/pot";
import { ITEM_INCLUDE, estimateFromSteps, fromDay, getSettings, isMember, stepRows, toItemDTO } from "@/lib/data";

export async function POST(request: NextRequest) {
  const parsed = await readBody(request, itemCreateSchema);
  if ("error" in parsed) return parsed.error;

  const { steps, dueDate, ...fields } = parsed.data;
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
        members: isMember(settings.members, data.addedBy) ? undefined : { push: data.addedBy },
      },
    });
    return created;
  });

  return NextResponse.json({ item: toItemDTO(item) }, { status: 201 });
}
