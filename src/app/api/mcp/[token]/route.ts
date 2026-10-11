import { NextRequest } from "next/server";
import { isValidConnectorToken } from "@/lib/auth";
import { handlePost } from "@/lib/mcp";
import { SERVER } from "@/lib/mcp-tools";

// Claude's connector: add this URL in claude.ai (Settings → Connectors → Add
// custom connector) and Claude can read and edit the list from any Claude app.
// The token in the path is the only key, so a wrong one looks like nothing's here.

const notFound = () => new Response("Not found", { status: 404 });

export async function POST(request: NextRequest, ctx: RouteContext<"/api/mcp/[token]">) {
  const { token } = await ctx.params;
  if (!(await isValidConnectorToken(token))) return notFound();
  return handlePost(SERVER, request);
}

// Stateless: no standalone event stream to open and no session to end.
async function notAllowed(_request: NextRequest, ctx: RouteContext<"/api/mcp/[token]">) {
  const { token } = await ctx.params;
  if (!(await isValidConnectorToken(token))) return notFound();
  return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}

export const GET = notAllowed;
export const DELETE = notAllowed;
