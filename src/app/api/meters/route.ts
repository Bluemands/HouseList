import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readingCreateSchema } from "@/lib/validation";
import { fromDay, toReadingDTO } from "@/lib/data";
import { savePhoto } from "@/lib/photo-store";
import { readPhotoParts, storeFailure } from "@/lib/photo-upload";

/** A meter reading, with a photo of the dial when one was taken. */
export async function POST(request: NextRequest) {
  let form: FormData;
  let body: unknown;
  try {
    form = await request.formData();
    body = JSON.parse(String(form.get("reading")));
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = readingCreateSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return NextResponse.json({ error: first ?? "Check the reading" }, { status: 400 });
  }

  let photoId: string | null = null;
  if (form.has("full")) {
    const images = await readPhotoParts(form);
    if (!images) return NextResponse.json({ error: "That photo couldn't be read. Try another?" }, { status: 400 });
    photoId = randomUUID();
    try {
      await savePhoto(photoId, images);
    } catch (err) {
      const { error, status } = storeFailure(err);
      return NextResponse.json({ error }, { status });
    }
  }

  const reading = await prisma.meterReading.create({
    data: { ...parsed.data, takenOn: fromDay(parsed.data.takenOn)!, photoId },
  });
  return NextResponse.json({ reading: toReadingDTO(reading) }, { status: 201 });
}
