import { NextRequest, NextResponse } from "next/server";
import { commentCreateSchema } from "@/lib/validation";
import { itemResponse, readBody } from "@/lib/api-route";
import { addComment } from "@/lib/items-service";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/items/[id]/comments">) {
  const { id } = await ctx.params;
  const body = await readBody(request, commentCreateSchema);
  if ("error" in body) return body.error;

  if (!(await addComment(id, body.data))) {
    return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
  }
  return itemResponse(id);
}
