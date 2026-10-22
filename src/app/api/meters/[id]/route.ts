import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { removePhotos } from "@/lib/photo-store";

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/meters/[id]">) {
  const { id } = await ctx.params;
  const reading = await prisma.meterReading.findUnique({ where: { id }, select: { photoId: true } });
  // deleteMany so both phones deleting it at once is a no-op.
  await prisma.meterReading.deleteMany({ where: { id } });
  if (reading?.photoId) await removePhotos([reading.photoId]);
  return NextResponse.json({ ok: true });
}
