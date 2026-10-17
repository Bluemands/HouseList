import { NextRequest, NextResponse } from "next/server";
import { pieceUpdateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { deletePiece, updatePiece } from "@/lib/boards-service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/pieces/[id]">) {
  const { id } = await ctx.params;
  const parsed = await readBody(request, pieceUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const piece = await updatePiece(id, parsed.data);
  if (!piece) return NextResponse.json({ error: "Someone else took that off the board" }, { status: 404 });
  return NextResponse.json({ piece });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/pieces/[id]">) {
  const { id } = await ctx.params;
  await deletePiece(id);
  return NextResponse.json({ ok: true });
}
