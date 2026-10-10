import { NextResponse } from "next/server";
import { getState } from "@/lib/data";

export async function GET() {
  return NextResponse.json(await getState());
}
