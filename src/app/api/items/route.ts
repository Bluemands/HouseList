import { NextRequest, NextResponse } from "next/server";
import { itemCreateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { createItem } from "@/lib/items-service";

export async function POST(request: NextRequest) {
  const parsed = await readBody(request, itemCreateSchema);
  if ("error" in parsed) return parsed.error;
  return NextResponse.json({ item: await createItem(parsed.data) }, { status: 201 });
}
