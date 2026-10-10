import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemCreateSchema } from "@/lib/validation";
import { ITEM_INCLUDE, fromDay, getSettings, toItemDTO } from "@/lib/data";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = itemCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { steps, dueDate, ...data } = parsed.data;
  const done = data.status === "DONE";
  const actualPrice = done ? (data.actualPrice ?? data.estimatedPrice ?? null) : (data.actualPrice ?? null);

  const settings = await getSettings();
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.item.create({
      data: {
        ...data,
        actualPrice,
        dueDate: fromDay(dueDate),
        completedAt: done ? new Date() : null,
        completedBy: done ? data.addedBy : null,
        steps: steps?.length
          ? { create: steps.map((s, position) => ({ text: s.text, done: s.done ?? false, position })) }
          : undefined,
      },
      include: ITEM_INCLUDE,
    });
    await tx.settings.update({
      where: { id: 1 },
      data: {
        // Logging something already bought spends it from the pot.
        budgetAvailable: done && actualPrice ? { decrement: actualPrice } : undefined,
        members: settings.members.includes(data.addedBy) ? undefined : { push: data.addedBy },
      },
    });
    return created;
  });

  return NextResponse.json({ item: toItemDTO(item) }, { status: 201 });
}
