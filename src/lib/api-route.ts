import { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ITEM_INCLUDE, toItemDTO } from "@/lib/data";

/** Parse a JSON body against a schema, or produce the 400 to return. */
export async function readBody<S extends z.ZodType>(
  request: NextRequest,
  schema: S,
): Promise<{ data: z.output<S> } | { error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: NextResponse.json({ error: "Invalid request body" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    const first = Object.values(fieldErrors).flat()[0];
    return {
      error: NextResponse.json({ error: first ?? "Check the highlighted fields", fieldErrors }, { status: 400 }),
    };
  }
  return { data: parsed.data };
}

/** The whole item, as every sub-resource route answers with it. */
export async function itemResponse(itemId: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId }, include: ITEM_INCLUDE });
  if (!item) return NextResponse.json({ error: "Someone else deleted this" }, { status: 404 });
  return NextResponse.json({ item: toItemDTO(item) });
}
