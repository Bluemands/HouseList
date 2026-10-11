import { NextRequest, NextResponse } from "next/server";
import { quoteCreateSchema } from "@/lib/validation";
import { itemResponse, readBody } from "@/lib/api-route";
import { addQuote } from "@/lib/items-service";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/items/[id]/quotes">) {
  const { id } = await ctx.params;
  const body = await readBody(request, quoteCreateSchema);
  if ("error" in body) return body.error;

  if (!(await addQuote(id, body.data))) {
    return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
  }
  return itemResponse(id);
}
