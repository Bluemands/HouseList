import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, computeAuthToken, isValidPin } from "@/lib/auth";
import { clearFailures, loginLimits, recordFailure, retryAfter } from "@/lib/throttle";

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

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const limits = loginLimits(ip);
  const wait = await retryAfter(limits);
  if (wait > 0) {
    const minutes = Math.ceil(wait / 60);
    return NextResponse.json(
      { error: `Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  if (!isValidPin(pin)) {
    await recordFailure(limits);
    return NextResponse.json({ error: "That PIN isn't right" }, { status: 401 });
  }
  await clearFailures(limits[0].key);

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
