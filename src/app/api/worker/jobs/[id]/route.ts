import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isWorkerRequest } from "@/lib/auth";
import { readBody } from "@/lib/api-route";
import {
  aiResultSchema,
  autofillChanges,
  claudeNote,
  improveChanges,
  type AiResult,
  type ImproveUndo,
  workerSubmitSchema,
} from "@/lib/ai";
import { getItem, updateItem } from "@/lib/items-service";

// The worker hands back Claude's answer (or why there isn't one).
export async function POST(request: NextRequest, ctx: RouteContext<"/api/worker/jobs/[id]">) {
  if (!(await isWorkerRequest(request))) {
    return NextResponse.json({ error: "Wrong or missing worker token" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await readBody(request, workerSubmitSchema);
  if ("error" in body) return body.error;

  // Only a job still out with a worker takes an answer. One dismissed in the
  // meantime stays dismissed; a late answer to a re-queued one still counts.
  const where = { id, status: { in: ["RUNNING" as const, "QUEUED" as const] } };
  const finishedAt = new Date();

  if (!body.data.ok) {
    const { count } = await prisma.aiJob.updateMany({
      where,
      data: { status: "FAILED", error: body.data.error, finishedAt },
    });
    return NextResponse.json({ ok: true, ignored: count === 0 });
  }

  const parsed = aiResultSchema.safeParse(body.data.result);
  if (!parsed.success) {
    await prisma.aiJob.updateMany({
      where,
      data: { status: "FAILED", error: "Claude's answer came back in a shape the app couldn't read.", finishedAt },
    });
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: `Result didn't validate: ${issue?.path.join(".") || "result"}: ${issue?.message}` },
      { status: 400 },
    );
  }

  const { count } = await prisma.aiJob.updateMany({
    where,
    data: { status: "DONE", result: parsed.data as Prisma.InputJsonValue, error: null, finishedAt },
  });
  if (count) await fillIn(id, parsed.data);
  return NextResponse.json({ ok: true, ignored: count === 0 });
}

// Added from quick add with "Ask Claude": the answer goes straight into the
// item, through the same rules as any other edit. If that fails, the answer
// stays a suggestion to use by hand.
async function fillIn(jobId: string, result: AiResult) {
  const job = await prisma.aiJob.findUnique({
    where: { id: jobId },
    select: { autofill: true, itemId: true, kind: true, question: true },
  });
  if (job?.kind === "IMPROVE" && job.itemId) return improve(jobId, job.itemId, job.question, result);
  if (!job?.autofill || !job.itemId) return;
  try {
    const item = await getItem(job.itemId);
    if (!item) return;
    const { changes, appendSteps } = autofillChanges(item, result);
    const updated = await updateItem(job.itemId, { ...changes, actor: "Claude" }, { appendSteps });
    if (updated) await prisma.aiJob.updateMany({ where: { id: jobId, status: "DONE" }, data: { status: "ACCEPTED" } });
  } catch (err) {
    console.error("Couldn't fill in the item from Claude's answer", err);
  }
}

// Improve with Claude: the answer revises the item in place and is posted as
// an update. The job stays DONE, carrying what to put back, until someone
// keeps the change or undoes it. If applying fails, it's a plain suggestion.
async function improve(jobId: string, itemId: string, question: string | null, result: AiResult) {
  try {
    const item = await getItem(itemId);
    if (!item) return;
    const { changes, addedLinks } = improveChanges(item, result);
    const updated = await updateItem(itemId, { ...changes, actor: "Claude" });
    if (!updated) return;
    const lead = question ? `Improved, as asked (“${question.slice(0, 120)}”):` : "Improved:";
    const comment = await prisma.comment.create({
      data: { itemId, author: "Claude", text: claudeNote(result, lead).slice(0, 1000) },
    });
    const undo: ImproveUndo = {
      before: {
        estimatedPrice: item.estimatedPrice,
        estimateMax: item.estimateMax,
        steps: changes.steps
          ? item.steps.map(({ id, text, done, cost, link, notes }) => ({ id, text, done, cost, link, notes }))
          : null,
      },
      after: { estimatedPrice: updated.item.estimatedPrice, estimateMax: updated.item.estimateMax },
      addedLinks,
      commentId: comment.id,
    };
    await prisma.aiJob.updateMany({ where: { id: jobId, status: "DONE" }, data: { undo } });
  } catch (err) {
    console.error("Couldn't improve the item from Claude's answer", err);
  }
}
