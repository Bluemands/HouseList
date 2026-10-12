import { NextRequest, NextResponse } from "next/server";
import { itemBulkCreateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { createItems } from "@/lib/items-service";
import { clip, notifyLater } from "@/lib/push";

// Many items at once: a pasted list, or the new-home essentials.
export async function POST(request: NextRequest) {
  const parsed = await readBody(request, itemBulkCreateSchema);
  if ("error" in parsed) return parsed.error;
  const items = await createItems(parsed.data);
  const { addedBy } = parsed.data;
  if (items.length) {
    notifyLater(
      {
        title: items.length === 1 ? `${addedBy} added` : `${addedBy} added ${items.length} things`,
        body: clip(items.map((i) => i.title).join(", ")),
        url: "/?v=list",
        tag: "bulk",
      },
      { except: addedBy },
    );
  }
  return NextResponse.json({ items }, { status: 201 });
}
