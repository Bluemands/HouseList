import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemBulkCreateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { ITEM_INCLUDE, estimateFromSteps, fromDay, getSettings, isMember, stepRows, toItemDTO } from "@/lib/data";

// Many items at once: a pasted list, or the new-home essentials.
export async function POST(request: NextRequest) {
  const parsed = await readBody(request, itemBulkCreateSchema);
  if ("error" in parsed) return parsed.error;

  const { addedBy, items } = parsed.data;
  const settings = await getSettings();
  const created = await prisma.$transaction(async (tx) => {
    const out = [];
    // Oldest-first timestamps keep the list in the order it was written.
    const base = Date.now() - items.length;
    for (const [index, { steps, dueDate, ...data }] of items.entries()) {
      out.push(
        await tx.item.create({
          data: {
            ...data,
            ...estimateFromSteps(steps),
            status: data.status === "DONE" ? "TODO" : data.status,
            addedBy,
            dueDate: fromDay(dueDate),
            createdAt: new Date(base + index),
            steps: steps?.length ? { create: stepRows(steps) } : undefined,
          },
          include: ITEM_INCLUDE,
        }),
      );
    }
    if (!isMember(settings.members, addedBy)) {
      await tx.settings.update({ where: { id: 1 }, data: { members: { push: addedBy } } });
    }
    return out;
  });

  return NextResponse.json({ items: created.map(toItemDTO) }, { status: 201 });
}
