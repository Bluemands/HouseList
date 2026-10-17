import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { itemResponse } from "@/lib/api-route";
import { readPhoto, removePhotos } from "@/lib/photo-store";

const PHOTO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The image, behind the PIN like everything else. A photo never changes, so phones keep it. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  const size = request.nextUrl.searchParams.get("size") === "thumb" ? "thumb" : "full";
  const image = PHOTO_ID.test(id) ? await readPhoto(id, size) : null;
  if (!image) return new NextResponse(null, { status: 404 });
  return new NextResponse(image, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/photos/[id]">) {
  const { id } = await ctx.params;
  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ ok: true });
  // deleteMany so both phones removing it at once is a no-op, not an error.
  await prisma.photo.deleteMany({ where: { id } });
  await removePhotos([id]);
  return itemResponse(photo.itemId);
}
