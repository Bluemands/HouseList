import { NextRequest, NextResponse } from "next/server";
import { commentCreateSchema } from "@/lib/validation";
import { itemResponse, readBody } from "@/lib/api-route";
import { addComment, getItem } from "@/lib/items-service";
import { clip, itemUrl, notifyLater } from "@/lib/push";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/items/[id]/comments">) {
  const { id } = await ctx.params;
  const body = await readBody(request, commentCreateSchema);
  if ("error" in body) return body.error;

  if (!(await addComment(id, body.data))) {
    return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
  }
  const item = await getItem(id);
  if (item) {
    notifyLater(
      { title: `${body.data.author} on ${clip(item.title, 60)}`, body: clip(body.data.text), url: itemUrl(id), tag: `item-${id}` },
      { except: body.data.author },
    );
  }
  return itemResponse(id);
}
