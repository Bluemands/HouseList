import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, computeAuthToken, isValidPin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const pin = typeof (body as { pin?: unknown })?.pin === "string" ? (body as { pin: string }).pin : "";

  if (!pin) {
    return NextResponse.json({ error: "Enter the PIN" }, { status: 400 });
  }

  if (!isValidPin(pin)) {
    return NextResponse.json({ error: "That PIN isn't right" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, await computeAuthToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
