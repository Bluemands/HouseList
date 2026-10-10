import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { quoteCreateSchema } from "@/lib/validation";
import { itemResponse, readBody } from "@/lib/api-route";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/items/[id]/quotes">) {
  const { id } = await ctx.params;
  const body = await readBody(request, quoteCreateSchema);
  if ("error" in body) return body.error;

  const exists = await prisma.item.count({ where: { id } });
  if (!exists) return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });

  await prisma.quote.create({ data: { ...body.data, note: body.data.note ?? null, itemId: id } });
  return itemResponse(id);
}
