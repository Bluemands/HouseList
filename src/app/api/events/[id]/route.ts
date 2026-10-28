import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventUpdateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { fromDay, toEventDTO } from "@/lib/data";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  const parsed = await readBody(request, eventUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const { date, endDate, ...rest } = parsed.data;
  const { count } = await prisma.calendarEvent.updateMany({
    where: { id },
    data: { ...rest, date: fromDay(date) ?? undefined, endDate: fromDay(endDate) },
  });
  const event = count ? await prisma.calendarEvent.findUnique({ where: { id } }) : null;
  if (!event) return NextResponse.json({ error: "Someone else deleted it" }, { status: 404 });
  return NextResponse.json({ event: toEventDTO(event) });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  // deleteMany so both phones deleting it at once is a no-op.
  await prisma.calendarEvent.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
