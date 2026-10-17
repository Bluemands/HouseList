import { NextRequest, NextResponse } from "next/server";
import { pieceToItemSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { BoardError, pieceToItem } from "@/lib/boards-service";
import { getItem } from "@/lib/items-service";
import { itemUrl, notifyLater } from "@/lib/push";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/pieces/[id]/to-item">) {
  const { id } = await ctx.params;
  const parsed = await readBody(request, pieceToItemSchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { piece, itemId } = await pieceToItem(id, parsed.data);
    const item = await getItem(itemId);
    if (item) {
      notifyLater(
        { title: `${item.addedBy} added`, body: item.title, url: itemUrl(item.id), tag: `item-${item.id}` },
        { except: item.addedBy },
      );
    }
    return NextResponse.json({ piece, item });
  } catch (err) {
    if (err instanceof BoardError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
