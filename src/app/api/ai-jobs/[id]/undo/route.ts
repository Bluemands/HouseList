import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readBody } from "@/lib/api-route";
import { toAiJobDTO } from "@/lib/data";
import { improveUndoSchema, undoImproveChanges } from "@/lib/ai";
import { getItem, updateItem } from "@/lib/items-service";

const undoBodySchema = z.object({ actor: z.string().trim().min(1).max(60) });

// Taking back what "Improve with Claude" changed. Only an applied improvement
// still waiting to be kept can be undone, and only once: the job is claimed
// (DONE → DISMISSED) before the item is touched, so two taps can't both undo.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/ai-jobs/[id]/undo">) {
  const { id } = await ctx.params;
  const body = await readBody(request, undoBodySchema);
  if ("error" in body) return body.error;

  const job = await prisma.aiJob.findUnique({ where: { id } });
  const undo = improveUndoSchema.safeParse(job?.undo);
  if (!job?.itemId || job.kind !== "IMPROVE" || !undo.success) {
    return NextResponse.json({ error: "There's nothing of Claude's to undo here" }, { status: 404 });
  }
  const { count } = await prisma.aiJob.updateMany({ where: { id, status: "DONE" }, data: { status: "DISMISSED" } });
  if (!count) {
    return NextResponse.json({ error: "Someone's already kept or undone Claude's changes" }, { status: 409 });
  }

  const item = await getItem(job.itemId);
  if (!item) return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
  const changes = undoImproveChanges(item, undo.data);
  const updated = Object.keys(changes).length ? await updateItem(job.itemId, { ...changes, actor: body.data.actor }) : null;
  if (undo.data.commentId) await prisma.comment.deleteMany({ where: { id: undo.data.commentId } });

  return NextResponse.json({
    job: toAiJobDTO({ ...job, status: "DISMISSED" }),
    item: (await getItem(job.itemId)) ?? item,
    potDelta: updated?.potDelta ?? 0,
  });
}
