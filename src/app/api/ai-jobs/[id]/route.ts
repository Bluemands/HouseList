import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBody } from "@/lib/api-route";
import { toAiJobDTO } from "@/lib/data";
import { JOB_TRANSITIONS, aiJobUpdateSchema } from "@/lib/ai";

// Dealing with a suggestion: used (ACCEPTED), dismissed (or that undone: DONE),
// or a failed one sent round again (QUEUED). Using one changes the item through
// the item routes, like any other edit; this only records that it's been dealt with.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/ai-jobs/[id]">) {
  const { id } = await ctx.params;
  const body = await readBody(request, aiJobUpdateSchema);
  if ("error" in body) return body.error;
  const { status } = body.data;

  const retry = status === "QUEUED";
  // updateMany on the expected status, so a tap that arrives after the other
  // phone (or the worker) has moved the job on is a no-op, not an overwrite.
  await prisma.aiJob.updateMany({
    where: {
      id,
      status: { in: JOB_TRANSITIONS[status] },
      // Undoing a dismiss brings back an answer, never a cancelled question.
      ...(status === "DONE" ? { finishedAt: { not: null }, error: null } : {}),
    },
    data: retry ? { status, error: null, attempts: 0, claimedAt: null, finishedAt: null } : { status },
  });
  const job = await prisma.aiJob.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "That suggestion's gone" }, { status: 404 });
  return NextResponse.json({ job: toAiJobDTO(job) });
}
