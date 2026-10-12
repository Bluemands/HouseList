import { NextRequest, NextResponse } from "next/server";
import { itemCreateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { createItem } from "@/lib/items-service";
import { itemUrl, notifyLater } from "@/lib/push";

export async function POST(request: NextRequest) {
  const parsed = await readBody(request, itemCreateSchema);
  if ("error" in parsed) return parsed.error;
  const item = await createItem(parsed.data);
  notifyLater(
    { title: `${item.addedBy} added`, body: item.title, url: itemUrl(item.id), tag: `item-${item.id}` },
    { except: item.addedBy },
  );
  return NextResponse.json({ item }, { status: 201 });
}
