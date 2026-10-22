import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tradespersonCreateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { toTradespersonDTO } from "@/lib/data";

export async function POST(request: NextRequest) {
  const parsed = await readBody(request, tradespersonCreateSchema);
  if ("error" in parsed) return parsed.error;
  const person = await prisma.tradesperson.create({ data: parsed.data });
  return NextResponse.json({ tradesperson: toTradespersonDTO(person) }, { status: 201 });
}
