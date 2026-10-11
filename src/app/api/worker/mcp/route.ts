import { NextRequest, NextResponse } from "next/server";
import { isWorkerRequest } from "@/lib/auth";
import { handlePost } from "@/lib/mcp";
import { PRICE_SERVER } from "@/lib/mcp-tools";

// The Ask Claude worker hands this to claude as an MCP server, so research can
// read Amazon prices (which web fetch can't) while the key stays here. Only
// the price tools: nothing on this server can change the list.

const unauthorised = () => NextResponse.json({ error: "Wrong or missing worker token" }, { status: 401 });

export async function POST(request: NextRequest) {
  if (!(await isWorkerRequest(request))) return unauthorised();
  return handlePost(PRICE_SERVER, request);
}

// Stateless: no standalone event stream to open and no session to end.
async function notAllowed(request: NextRequest) {
  if (!(await isWorkerRequest(request))) return unauthorised();
  return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}

export const GET = notAllowed;
export const DELETE = notAllowed;
