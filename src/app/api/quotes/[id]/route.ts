import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { quoteUpdateSchema } from "@/lib/validation";
import { itemResponse, readBody } from "@/lib/api-route";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/quotes/[id]">) {
  const { id } = await ctx.params;
  const body = await readBody(request, quoteUpdateSchema);
  if ("error" in body) return body.error;

  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ error: "That quote's gone" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    const updated = await tx.quote.update({ where: { id }, data: body.data });
    if (body.data.chosen) {
      // One chosen quote per item, and choosing it fixes the item's cost.
      await tx.quote.updateMany({ where: { itemId: quote.itemId, id: { not: id } }, data: { chosen: false } });
      await tx.item.update({
        where: { id: quote.itemId },
        data: { estimatedPrice: updated.amount, estimateMax: null, isQuote: true },
      });
    } else if (body.data.chosen === false && quote.chosen) {
      // Unchoosing keeps the cost as it was, but it's no longer a firm quote.
      await tx.item.update({ where: { id: quote.itemId }, data: { isQuote: false } });
    } else if (updated.chosen && body.data.amount !== undefined) {
      await tx.item.update({ where: { id: quote.itemId }, data: { estimatedPrice: updated.amount } });
    }
  });

  return itemResponse(quote.itemId);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/quotes/[id]">) {
  const { id } = await ctx.params;
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ ok: true });
  await prisma.$transaction(async (tx) => {
    await tx.quote.delete({ where: { id } });
    // Dropping the chosen quote leaves the cost as it was, but it's no
    // longer a firm quote.
    if (quote.chosen) await tx.item.update({ where: { id: quote.itemId }, data: { isQuote: false } });
  });
  return itemResponse(quote.itemId);
}
