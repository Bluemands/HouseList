import { NextRequest, NextResponse } from "next/server";
import { boardCreateSchema } from "@/lib/validation";
import { readBody } from "@/lib/api-route";
import { createBoard } from "@/lib/boards-service";

export async function POST(request: NextRequest) {
  const parsed = await readBody(request, boardCreateSchema);
  if ("error" in parsed) return parsed.error;
  return NextResponse.json({ board: await createBoard(parsed.data) }, { status: 201 });
}
