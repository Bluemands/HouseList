import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { commentCreateSchema } from "@/lib/validation";
import { itemResponse, readBody } from "@/lib/api-route";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/items/[id]/comments">) {
  const { id } = await ctx.params;
  const body = await readBody(request, commentCreateSchema);
  if ("error" in body) return body.error;

  const exists = await prisma.item.count({ where: { id } });
  if (!exists) return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });

  await prisma.comment.create({ data: { ...body.data, itemId: id } });
  return itemResponse(id);
}
