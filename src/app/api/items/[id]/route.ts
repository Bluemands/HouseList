import { NextRequest, NextResponse } from "next/server";
import { itemUpdateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { deleteItem, getItem, updateItem } from "@/lib/items-service";
import { itemUrl, notifyLater } from "@/lib/push";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  const body = await readBody(request, itemUpdateSchema);
  if ("error" in body) return body.error;

  const result = await updateItem(id, body.data);
  if (!result) return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });

  // Finished by one of you: the other hears, unless it's undone in the
  // undo window first.
  const actor = body.data.actor;
  if (result.completed && actor && actor !== "Claude") {
    const { item } = result;
    notifyLater(
      { title: `${actor} ${item.kind === "BUY" ? "bought" : "finished"}`, body: item.title, url: itemUrl(id), tag: `item-${id}` },
      { except: actor },
      { delayMs: 7_000, unless: async () => (await getItem(id))?.status !== "DONE" },
    );
  }
  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  await deleteItem(id);
  return NextResponse.json({ ok: true });
}
