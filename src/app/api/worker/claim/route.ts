import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWorkerRequest } from "@/lib/auth";
import { STALE_CLAIM_MS, staleOutcome } from "@/lib/ai";
import { amazonEnabled } from "@/lib/amazon";
import { ROOM_PAINT } from "@/lib/rooms";
import { KIND_LABELS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/types";

// The worker (scripts/ai-worker.mjs) asks here for the oldest waiting
// question, with everything it needs to answer it. No job: { job: null }.

/** Today's date in the UK, where the household is. */
const ukToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

export async function POST(request: NextRequest) {
  if (!(await isWorkerRequest(request))) {
    return NextResponse.json({ error: "Wrong or missing worker token" }, { status: 401 });
  }
  const now = new Date();

  // "Last checked in", for the app. Written at most once a minute: the worker
  // asks far more often than that.
  await prisma.$executeRaw`
    INSERT INTO "Settings" ("id", "workerSeenAt") VALUES (1, ${now})
    ON CONFLICT ("id") DO UPDATE SET "workerSeenAt" = ${now}
    WHERE "Settings"."workerSeenAt" IS NULL OR "Settings"."workerSeenAt" < ${new Date(now.getTime() - 60_000)}`;

  // A worker that died mid-job left it RUNNING: hand it out again, or give up
  // on one that has already been tried a few times.
  const stale = await prisma.aiJob.findMany({
    where: { status: "RUNNING", claimedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
  });
  for (const job of stale) {
    const outcome = staleOutcome(job, now);
    if (!outcome) continue;
    await prisma.aiJob.updateMany({
      where: { id: job.id, status: "RUNNING", claimedAt: job.claimedAt },
      data:
        outcome === "requeue"
          ? { status: "QUEUED", claimedAt: null }
          : {
              status: "FAILED",
              error: "The worker kept stopping partway through this one, so it's been put aside.",
              finishedAt: now,
            },
    });
  }

  // SKIP LOCKED: two workers asking at once never get the same job.
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "AiJob" SET "status" = 'RUNNING', "claimedAt" = ${now}, "attempts" = "attempts" + 1
    WHERE "id" = (
      SELECT "id" FROM "AiJob" WHERE "status" = 'QUEUED'
      ORDER BY "createdAt" LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"`;
  if (!claimed.length) return NextResponse.json({ job: null });

  const job = await prisma.aiJob.findUnique({
    where: { id: claimed[0].id },
    include: { item: { include: { steps: true, quotes: true } } },
  });
  const item = job?.item;
  if (!job || !item) {
    if (job) {
      await prisma.aiJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: "The item it was about has gone.", finishedAt: now },
      });
    }
    return NextResponse.json({ job: null });
  }

  return NextResponse.json({
    job: { id: job.id, kind: job.kind, question: job.question, attempts: job.attempts },
    item: {
      title: item.title,
      kind: KIND_LABELS[item.kind],
      room: ROOM_PAINT[item.room].label,
      priority: PRIORITY_LABELS[item.priority],
      status: STATUS_LABELS[item.kind][item.status],
      estimate:
        item.estimatedPrice == null && item.estimateMax == null
          ? null
          : { min: item.estimatedPrice ?? item.estimateMax, max: item.estimateMax ?? item.estimatedPrice },
      firmQuote: item.isQuote,
      notes: item.notes,
      project: item.project,
      dueDate: item.dueDate?.toISOString().slice(0, 10) ?? null,
      steps: [...item.steps]
        .sort((a, b) => a.position - b.position)
        .map(({ text, done, cost, link, notes }) => ({ text, done, cost, link, notes })),
      links: item.links,
      quotes: item.quotes.map(({ from, amount, note }) => ({ from, amount, note })),
    },
    // No address is kept, so the worker assumes somewhere in the UK.
    location: null,
    today: ukToday(),
    // Whether /api/worker/mcp can look up Amazon prices.
    amazon: amazonEnabled(),
  });
}
