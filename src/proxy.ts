import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, isValidAuthToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.includes(pathname);
  const isAuthApi = pathname === "/api/auth";
  // Calendar apps subscribe without a cookie; the route checks its own token.
  const isCalendarFeed = pathname.startsWith("/api/calendar/");
  // Neither can Claude's connector; that route checks its own token too.
  const isConnector = pathname.startsWith("/api/mcp/");
  // The AI worker has no cookie either; its routes check a bearer token.
  const isWorkerApi = pathname.startsWith("/api/worker/");

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const authed = await isValidAuthToken(token);

  if (authed) {
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (isPublicPath || isAuthApi || isCalendarFeed || isConnector || isWorkerApi) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Only the build's own assets skip the PIN. No file-extension rule: it let
  // "/api/items/x.png" reach an API route without the cookie check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest).*)"],
};
