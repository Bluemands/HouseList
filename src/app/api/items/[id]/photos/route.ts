import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { photoCreateSchema } from "@/lib/validation";
import { itemResponse } from "@/lib/api-route";
import { removePhotos, savePhoto } from "@/lib/photo-store";
import { PHOTOS_MAX } from "@/lib/types";
import { clip, itemUrl, notifyLater } from "@/lib/push";
import { readPhotoParts, storeFailure } from "@/lib/photo-upload";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/items/[id]/photos">) {
  const { id } = await ctx.params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const fields = photoCreateSchema.safeParse({
    width: form.get("width"),
    height: form.get("height"),
    addedBy: form.get("addedBy"),
  });
  const images = await readPhotoParts(form);
  if (!fields.success || !images) {
    return NextResponse.json({ error: "That photo couldn't be read. Try another?" }, { status: 400 });
  }

  const item = await prisma.item.findUnique({ where: { id }, select: { title: true, _count: { select: { photos: true } } } });
  if (!item) return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
  if (item._count.photos >= PHOTOS_MAX) {
    return NextResponse.json({ error: `That's the most one thing can have (${PHOTOS_MAX} photos)` }, { status: 400 });
  }

  const photoId = randomUUID();
  try {
    await savePhoto(photoId, images);
  } catch (err) {
    const { error, status } = storeFailure(err);
    return NextResponse.json({ error }, { status });
  }
  try {
    await prisma.photo.create({ data: { id: photoId, itemId: id, ...fields.data } });
  } catch {
    // The item went while the photo was uploading.
    await removePhotos([photoId]);
    return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
  }

  notifyLater(
    { title: `${fields.data.addedBy} added a photo`, body: clip(item.title), url: itemUrl(id), tag: `item-${id}` },
    { except: fields.data.addedBy },
  );
  return itemResponse(id);
}
