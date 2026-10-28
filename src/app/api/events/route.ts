import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventCreateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { fromDay, toEventDTO } from "@/lib/data";
import { notifyEventAdded } from "@/lib/events-push";

export async function POST(request: NextRequest) {
  const parsed = await readBody(request, eventCreateSchema);
  if ("error" in parsed) return parsed.error;
  const { date, endDate, ...rest } = parsed.data;
  const created = await prisma.calendarEvent.create({ data: { ...rest, date: fromDay(date)!, endDate: fromDay(endDate) } });
  const event = toEventDTO(created);
  notifyEventAdded(event);
  return NextResponse.json({ event }, { status: 201 });
}
