import { NextRequest, NextResponse } from "next/server";
import { itemUpdateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { deleteItem, updateItem } from "@/lib/items-service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  const body = await readBody(request, itemUpdateSchema);
  if ("error" in body) return body.error;

  const result = await updateItem(id, body.data);
  if (!result) return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  await deleteItem(id);
  return NextResponse.json({ ok: true });
}
