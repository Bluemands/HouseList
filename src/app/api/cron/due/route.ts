import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromDay, toEventDTO } from "@/lib/data";
import { eventsOn, formatTime } from "@/lib/events";
import { dayUrl } from "@/lib/events-push";
import { today } from "@/lib/format";
import { clip, itemUrl, notify, pushConfigured } from "@/lib/push";

/**
 * The morning reminder, run once a day by Vercel Cron (vercel.json). Each
 * person hears about what's due today that's theirs, "Both"'s or nobody's
 * in particular; things already overdue are mentioned alongside, and on
 * their own only on Mondays, so a slipped date nudges weekly, not daily.
 * Everyone also hears what's on the calendar today, and on the day of the
 * month you chose, it asks for meter readings.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  if (!pushConfigured()) return NextResponse.json({ ok: true, sent: 0 });

  const day = today();
  const [settings, items, phones] = await Promise.all([
    prisma.settings.findUnique({ where: { id: 1 }, select: { members: true, meterDay: true } }),
    prisma.item.findMany({
      where: { status: { not: "DONE" }, dueDate: { lte: fromDay(day)! } },
      select: { id: true, title: true, dueDate: true, assignee: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.pushSubscription.findMany({ select: { member: true }, distinct: ["member"] }),
  ]);
  const members = settings?.members ?? [];
  const monday = new Date(`${day}T12:00:00Z`).getUTCDay() === 1;

  let sent = 0;
  for (const { member } of phones) {
    // Someone else's named job isn't this person's reminder.
    const mine = items.filter(
      (i) => !i.assignee || i.assignee === member || !members.includes(i.assignee),
    );
    const dueToday = mine.filter((i) => i.dueDate?.toISOString().slice(0, 10) === day);
    const overdue = mine.filter((i) => i.dueDate && i.dueDate.toISOString().slice(0, 10) < day);
    if (!dueToday.length && !(monday && overdue.length)) continue;

    const late = overdue.length ? `${overdue.length} overdue` : "";
    const message = dueToday.length
      ? {
          title: dueToday.length === 1 ? "Due today" : `${dueToday.length} things due today`,
          body: clip([dueToday.map((i) => i.title).join(", "), late && `plus ${late}`].filter(Boolean).join(". ")),
          url: dueToday.length === 1 ? itemUrl(dueToday[0].id) : "/?v=list",
        }
      : {
          title: overdue.length === 1 ? "Still to do" : `${overdue.length} things past their date`,
          body: clip(overdue.map((i) => i.title).join(", ")),
          url: overdue.length === 1 ? itemUrl(overdue[0].id) : "/?v=list",
        };
    await notify({ ...message, tag: "due" }, { to: member });
    sent += 1;
  }

  // What's on today: birthdays, gigs, family dos.
  const on = eventsOn((await prisma.calendarEvent.findMany({ where: { date: { lte: fromDay(day)! } } })).map(toEventDTO), day);
  if (on.length) {
    await notify(
      {
        title: on.length === 1 ? "On today" : `${on.length} things on today`,
        body: clip(on.map((e) => (e.time ? `${e.title} at ${formatTime(e.time)}` : e.title)).join(", ")),
        url: dayUrl(day),
        tag: "events",
      },
      "everyone",
    );
    sent += 1;
  }

  // The monthly nudge to read the meters, on the day you chose.
  if (settings?.meterDay && Number(day.slice(8, 10)) === settings.meterDay) {
    await notify(
      { title: "Meter readings", body: "Time to read the gas, electric and water meters.", url: "/?v=money", tag: "meters" },
      "everyone",
    );
    sent += 1;
  }
  return NextResponse.json({ ok: true, sent });
}
