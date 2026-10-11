import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readBody } from "@/lib/api-route";
import { toAiJobDTO } from "@/lib/data";
import { aiJobCreateSchema, jobKindFor } from "@/lib/ai";

// Ask Claude about an item. This only queues the question: a worker on
// someone's computer picks it up (see /api/worker) and answers it.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/items/[id]/ai">) {
  const { id } = await ctx.params;
  const body = await readBody(request, aiJobCreateSchema);
  if ("error" in body) return body.error;
  const { question, requestedBy, autofill } = body.data;

  const result = await prisma.$transaction(async (tx) => {
    // One question per item at a time, even if both of you tap at once.
    await tx.$queryRaw`SELECT "id" FROM "Item" WHERE "id" = ${id} FOR UPDATE`;
    const item = await tx.item.findUnique({ where: { id }, select: { kind: true } });
    if (!item) return "gone" as const;
    const open = await tx.aiJob.count({ where: { itemId: id, status: { in: ["QUEUED", "RUNNING"] } } });
    if (open) return "busy" as const;
    // A new question replaces the last answer, so each item shows one card.
    await tx.aiJob.updateMany({
      where: { itemId: id, status: { in: ["DONE", "FAILED"] } },
      data: { status: "DISMISSED" },
    });
    return tx.aiJob.create({ data: { itemId: id, kind: jobKindFor(item.kind, question), question, requestedBy, autofill } });
  });

  if (result === "gone") return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
  if (result === "busy") {
    return NextResponse.json({ error: "Claude's already on this one. Give it a minute." }, { status: 409 });
  }
  return NextResponse.json({ job: toAiJobDTO(result) });
}
