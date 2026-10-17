import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api-route";
import { UnreadablePage, fetchImage } from "@/lib/fetch-page";

// A shop's product picture, fetched for the phone, which can't fetch it
// itself (shops don't allow it). The phone shrinks it and stores its own copy
// with the board piece, as pictures linked straight from shops break.

export const runtime = "nodejs";

const bodySchema = z.object({ url: z.url().max(2000) });

export async function POST(request: NextRequest) {
  const parsed = await readBody(request, bodySchema);
  if ("error" in parsed) return parsed.error;
  try {
    const { bytes, contentType } = await fetchImage(parsed.data.url);
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": contentType, "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof UnreadablePage ? err.message : "Couldn't fetch that picture";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
