import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemResponse } from "@/lib/api-route";

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/comments/[id]">) {
  const { id } = await ctx.params;
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return NextResponse.json({ ok: true });
  await prisma.comment.delete({ where: { id } });
  return itemResponse(comment.itemId);
}
