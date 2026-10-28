import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidCalendarToken } from "@/lib/auth";
import { ROOM_PAINT } from "@/lib/rooms";
import { PRIORITY_LABELS, REPEAT_LABELS } from "@/lib/types";
import { toEventDTO } from "@/lib/data";

// Every open item with a due date, as an all-day event, and the events you've
// put on the calendar. Subscribing to this from a phone calendar is how
// reminders work without the app sending any.

function esc(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 lines must fold at 75 octets. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

export async function GET(request: NextRequest, ctx: RouteContext<"/api/calendar/[token]">) {
  const { token } = await ctx.params;
  if (!(await isValidCalendarToken(token.replace(/\.ics$/, "")))) {
    return new Response("Not found", { status: 404 });
  }

  const items = await prisma.item.findMany({
    where: { status: { not: "DONE" }, dueDate: { not: null } },
    orderBy: { dueDate: "asc" },
  });
  // Guarantees still running, whether the thing is finished or not.
  const guaranteed = await prisma.item.findMany({
    where: { warrantyUntil: { gte: new Date(Date.now() - 86_400_000) } },
    orderBy: { warrantyUntil: "asc" },
  });

  const events = (await prisma.calendarEvent.findMany({ orderBy: { date: "asc" } })).map(toEventDTO);

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const origin = new URL(request.url).origin;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The House List//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:The House List",
    "X-PUBLISHED-TTL:PT1H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const item of items) {
    const start = item.dueDate!;
    const end = new Date(start.getTime() + 86_400_000);
    const details = [
      ROOM_PAINT[item.room].label,
      PRIORITY_LABELS[item.priority],
      item.assignee ? `Who: ${item.assignee}` : null,
      item.repeat ? REPEAT_LABELS[item.repeat] : null,
      item.notes,
    ].filter(Boolean);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}@house-list`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(start)}`,
      `DTEND;VALUE=DATE:${ymd(end)}`,
      fold(`SUMMARY:${esc(item.title)}`),
      fold(`DESCRIPTION:${esc(details.join("\n"))}`),
      `URL:${origin}/`,
      // A morning nudge on the day.
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:PT9H",
      fold(`DESCRIPTION:${esc(item.title)}`),
      "END:VALARM",
      "END:VEVENT",
    );
  }
  for (const item of guaranteed) {
    const end = item.warrantyUntil!;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.id}-guarantee@house-list`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(end)}`,
      `DTEND;VALUE=DATE:${ymd(new Date(end.getTime() + 86_400_000))}`,
      fold(`SUMMARY:${esc(`Guarantee ends: ${item.title}`)}`),
      fold(`DESCRIPTION:${esc(`The last day of its guarantee: anything wrong with it, claim now. ${ROOM_PAINT[item.room].label}.`)}`),
      `URL:${origin}/`,
      // A month's warning, while there's still time to get it looked at.
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-P30D",
      fold(`DESCRIPTION:${esc(`Guarantee ends in a month: ${item.title}`)}`),
      "END:VALARM",
      "END:VEVENT",
    );
  }
  for (const event of events) {
    // UK local time, written as "floating" time so it reads the same on any phone.
    const start = event.time
      ? `DTSTART:${event.date.replace(/-/g, "")}T${event.time.replace(":", "")}00`
      : `DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`;
    const last = event.endDate && event.endDate > event.date ? event.endDate : event.date;
    // A timed one runs a couple of hours (or to the same time on its last day); an all-day one to the end of its last day.
    const end = event.time
      ? last === event.date
        ? "DURATION:PT2H"
        : `DTEND:${last.replace(/-/g, "")}T${event.time.replace(":", "")}00`
      : `DTEND;VALUE=DATE:${ymd(new Date(new Date(`${last}T00:00:00Z`).getTime() + 86_400_000))}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}-event@house-list`,
      `DTSTAMP:${stamp}`,
      start,
      end,
      ...(event.repeat ? [`RRULE:FREQ=${event.repeat}`] : []),
      fold(`SUMMARY:${esc(event.title)}`),
      ...(event.notes ? [fold(`DESCRIPTION:${esc(event.notes)}`)] : []),
      `URL:${origin}/?day=${event.date}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
