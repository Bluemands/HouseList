import { NextRequest, NextResponse } from "next/server";
import { itemBulkCreateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { createItems } from "@/lib/items-service";

// Many items at once: a pasted list, or the new-home essentials.
export async function POST(request: NextRequest) {
  const parsed = await readBody(request, itemBulkCreateSchema);
  if ("error" in parsed) return parsed.error;
  return NextResponse.json({ items: await createItems(parsed.data) }, { status: 201 });
}
