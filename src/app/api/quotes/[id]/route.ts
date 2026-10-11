import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { quoteUpdateSchema } from "@/lib/validation";
import { itemResponse, readBody } from "@/lib/api-route";
import { updateQuote } from "@/lib/items-service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/quotes/[id]">) {
  const { id } = await ctx.params;
  const body = await readBody(request, quoteUpdateSchema);
  if ("error" in body) return body.error;

  const itemId = await updateQuote(id, body.data);
  if (!itemId) return NextResponse.json({ error: "That quote's gone" }, { status: 404 });
  return itemResponse(itemId);
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
