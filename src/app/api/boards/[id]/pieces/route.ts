import { NextRequest, NextResponse } from "next/server";
import { pieceCreateSchema } from "@/lib/validation";
import { BoardError, addPiece } from "@/lib/boards-service";
import { readPhotoParts, storeFailure } from "@/lib/photo-upload";

// A piece arrives as a form: "piece" holds its JSON, and a photo or a shop's
// picture comes beside it as "full" and "thumb", already shrunk by the phone.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/boards/[id]/pieces">) {
  const { id } = await ctx.params;
  let form: FormData;
  let json: unknown;
  try {
    form = await request.formData();
    json = JSON.parse(String(form.get("piece") ?? ""));
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = pieceCreateSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "That couldn't be added. Try again?" }, { status: 400 });

  const hasImage = form.has("full");
  const image = hasImage ? await readPhotoParts(form) : null;
  if (hasImage && !image) return NextResponse.json({ error: "That picture couldn't be read. Try another?" }, { status: 400 });
  if (parsed.data.kind === "PHOTO" && !image) return NextResponse.json({ error: "Add a photo first" }, { status: 400 });

  try {
    return NextResponse.json({ piece: await addPiece(id, parsed.data, image) }, { status: 201 });
  } catch (err) {
    if (err instanceof BoardError) return NextResponse.json({ error: err.message }, { status: err.status });
    const { error, status } = storeFailure(err);
    return NextResponse.json({ error }, { status });
  }
}
