import { NextRequest, NextResponse } from "next/server";
import { boardUpdateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { deleteBoard, updateBoard } from "@/lib/boards-service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/boards/[id]">) {
  const { id } = await ctx.params;
  const parsed = await readBody(request, boardUpdateSchema);
  if ("error" in parsed) return parsed.error;
  const board = await updateBoard(id, parsed.data);
  if (!board) return NextResponse.json({ error: "Someone else deleted this board" }, { status: 404 });
  return NextResponse.json({ board });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/boards/[id]">) {
  const { id } = await ctx.params;
  await deleteBoard(id);
  return NextResponse.json({ ok: true });
}
