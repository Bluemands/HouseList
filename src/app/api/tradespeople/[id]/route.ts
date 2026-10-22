import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tradespersonUpdateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { toTradespersonDTO } from "@/lib/data";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/tradespeople/[id]">) {
  const { id } = await ctx.params;
  const parsed = await readBody(request, tradespersonUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const { count } = await prisma.tradesperson.updateMany({ where: { id }, data: parsed.data });
  const person = count ? await prisma.tradesperson.findUnique({ where: { id } }) : null;
  if (!person) return NextResponse.json({ error: "Someone else deleted them" }, { status: 404 });
  return NextResponse.json({ tradesperson: toTradespersonDTO(person) });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/tradespeople/[id]">) {
  const { id } = await ctx.params;
  // deleteMany so both phones deleting them at once is a no-op.
  await prisma.tradesperson.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
