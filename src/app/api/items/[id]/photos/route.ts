import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { photoCreateSchema } from "@/lib/validation";
import { itemResponse } from "@/lib/api-route";
import { removePhotos, savePhoto } from "@/lib/photo-store";
import { PHOTOS_MAX } from "@/lib/types";
import { clip, itemUrl, notifyLater } from "@/lib/push";

// The phone shrinks a photo before sending it (lib/photo-resize.ts), so these
// are generous: a full copy is usually a few hundred KB, a thumbnail ~40 KB.
const FULL_MAX = 3 * 1024 * 1024;
const THUMB_MAX = 512 * 1024;

/** The upload's bytes, if it's a JPEG of a sensible size. */
async function jpeg(part: FormDataEntryValue | null, max: number) {
  if (!(part instanceof Blob) || part.size === 0 || part.size > max) return null;
  const bytes = new Uint8Array(await part.arrayBuffer());
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? bytes : null;
}

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
  const full = await jpeg(form.get("full"), FULL_MAX);
  const thumb = await jpeg(form.get("thumb"), THUMB_MAX);
  if (!fields.success || !full || !thumb) {
    return NextResponse.json({ error: "That photo couldn't be read. Try another?" }, { status: 400 });
  }

  const item = await prisma.item.findUnique({ where: { id }, select: { title: true, _count: { select: { photos: true } } } });
  if (!item) return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
  if (item._count.photos >= PHOTOS_MAX) {
    return NextResponse.json({ error: `That's the most one thing can have (${PHOTOS_MAX} photos)` }, { status: 400 });
  }

  const photoId = randomUUID();
  try {
    await savePhoto(photoId, { full, thumb });
  } catch (err) {
    console.error("Couldn't store a photo", err);
    const unset = err instanceof Error && err.message.startsWith("Photos aren't set up");
    return NextResponse.json(
      { error: unset ? err.message : "Couldn't save the photo. Try again?" },
      { status: unset ? 503 : 502 },
    );
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
