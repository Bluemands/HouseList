// A small, stateless MCP server over Streamable HTTP: each POST carries one
// JSON-RPC message (or, for 2025-03-26 clients, a batch) and gets a plain JSON
// answer back. No SSE, no sessions — every tool here answers in one go.
//
// It speaks both eras of the protocol, because clients are mid-migration:
//  - Legacy (2025-03-26 to 2025-11-25): an `initialize` handshake first, then
//    requests. Nothing about the handshake is remembered between requests;
//    it only tells the client what we speak.
//  - Modern (2026-07-28 on): no handshake; every request carries its version
//    in `params._meta`, mirrored into the MCP-Protocol-Version header.

export const LEGACY_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const MODERN_VERSIONS = ["2026-07-28"] as const;
const SUPPORTED: readonly string[] = [...MODERN_VERSIONS, ...LEGACY_VERSIONS];

const META_VERSION = "io.modelcontextprotocol/protocolVersion";

/** How long a modern client may keep the tool list. */
const TOOLS_TTL_MS = 10 * 60_000;

// JSON-RPC and MCP error codes.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;
const HEADER_MISMATCH = -32020;
const UNSUPPORTED_VERSION = -32022;

export type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

export type McpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  run: (args: unknown) => Promise<ToolResult>;
};

export type McpServer = {
  name: string;
  title: string;
  version: string;
  instructions: string;
  tools: McpTool[];
};

type Id = string | number | null;
type Message = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown; result?: unknown; error?: unknown };
type Reply = { status: number; body?: Record<string, unknown> };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const success = (id: Id, result: Record<string, unknown>): Reply => ({ status: 200, body: { jsonrpc: "2.0", id, result } });

function failure(status: number, id: Id, code: number, message: string, data?: unknown): Reply {
  return { status, body: { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } } };
}

/** Mcp-Name may arrive base64-wrapped when the name isn't plain ASCII. */
function decodeHeader(value: string): string {
  const m = /^=\?base64\?(.*)\?=$/.exec(value);
  return m ? Buffer.from(m[1], "base64").toString("utf8") : value;
}

/** The answer to one JSON-RPC message, or a bare 202 for a notification. */
export async function handleMessage(server: McpServer, msg: unknown, headers: Headers | null): Promise<Reply> {
  if (!isObject(msg)) return failure(400, null, INVALID_REQUEST, "Expected a JSON-RPC message");
  const { id, method, params } = msg as Message;
  const validId = typeof id === "string" || typeof id === "number";

  // Responses (a legacy client answering something) and notifications need no reply.
  if (method === undefined && ("result" in msg || "error" in msg)) return { status: 202 };
  if (msg.jsonrpc !== "2.0" || typeof method !== "string" || (id !== undefined && !validId)) {
    return failure(400, validId ? id : null, INVALID_REQUEST, "Not a valid JSON-RPC 2.0 request");
  }
  if (id === undefined) return { status: 202 };
  if (params !== undefined && !isObject(params)) return failure(400, id, INVALID_PARAMS, "params must be an object");

  const meta = isObject(params?._meta) ? params._meta : undefined;
  const requested = meta?.[META_VERSION];
  const modern = typeof requested === "string" && !(LEGACY_VERSIONS as readonly string[]).includes(requested);
  const headerVersion = headers?.get("mcp-protocol-version") ?? null;

  if (modern) {
    if (!(MODERN_VERSIONS as readonly string[]).includes(requested)) {
      return failure(400, id, UNSUPPORTED_VERSION, "Unsupported protocol version", { supported: SUPPORTED, requested });
    }
    // The headers mirror the body for anything routing on them, so they must agree.
    if (headers) {
      const mismatch =
        headerVersion !== requested
          ? `MCP-Protocol-Version header ${headerVersion ?? "(missing)"} does not match ${requested}`
          : headers.has("mcp-method") && headers.get("mcp-method") !== method
            ? `Mcp-Method header does not match ${method}`
            : headers.has("mcp-name") && decodeHeader(headers.get("mcp-name")!) !== params?.name
              ? "Mcp-Name header does not match params.name"
              : null;
      if (mismatch) return failure(400, id, HEADER_MISMATCH, `Header mismatch: ${mismatch}`);
    }
  } else if (headerVersion && !SUPPORTED.includes(headerVersion)) {
    return failure(400, id, INVALID_REQUEST, `Unsupported protocol version ${headerVersion}`, { supported: SUPPORTED });
  } else if (headerVersion && (MODERN_VERSIONS as readonly string[]).includes(headerVersion) && method !== "initialize") {
    return failure(400, id, INVALID_PARAMS, `Missing params._meta["${META_VERSION}"]`);
  }

  // Modern results say what kind of result they are, and who answered.
  const reply = (result: Record<string, unknown>) =>
    success(
      id,
      modern
        ? { resultType: "complete", ...result, _meta: { "io.modelcontextprotocol/serverInfo": serverInfo(server) } }
        : result,
    );
  const notFound = () => failure(modern ? 404 : 200, id, METHOD_NOT_FOUND, `Method not found: ${method}`);

  switch (method) {
    case "initialize": {
      if (modern) return notFound();
      const asked = isObject(params) ? params.protocolVersion : undefined;
      const protocolVersion =
        typeof asked === "string" && (LEGACY_VERSIONS as readonly string[]).includes(asked) ? asked : LEGACY_VERSIONS[0];
      return reply({
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: serverInfo(server),
        instructions: server.instructions,
      });
    }
    case "server/discover":
      if (!modern) return notFound();
      return reply({
        supportedVersions: SUPPORTED,
        capabilities: { tools: {} },
        instructions: server.instructions,
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({
        tools: server.tools.map(({ name, title, description, inputSchema, annotations }) => ({
          name,
          title,
          description,
          inputSchema,
          annotations,
        })),
        // Modern clients refuse a list without caching terms. It's per token,
        // so private, and it only changes on a deploy.
        ...(modern ? { ttlMs: TOOLS_TTL_MS, cacheScope: "private" } : {}),
      });
    case "tools/call": {
      const name = params?.name;
      const tool = server.tools.find((t) => t.name === name);
      if (!tool) return failure(modern ? 400 : 200, id, INVALID_PARAMS, `Unknown tool: ${String(name)}`);
      try {
        return reply(await tool.run(params?.arguments ?? {}));
      } catch (err) {
        console.error(`MCP tool ${tool.name} failed`, err);
        // A failed call is something Claude can read and react to, not a protocol fault.
        return reply({ content: [{ type: "text", text: "Something went wrong saving that. Try again in a moment." }], isError: true });
      }
    }
    default:
      return notFound();
  }
}

function serverInfo(server: McpServer) {
  return { name: server.name, title: server.title, version: server.version };
}

/**
 * Browsers send Origin; server-side clients (claude.ai's connector service,
 * Claude Code) usually don't. A page on some other site must not be able to
 * drive the server from someone's browser.
 */
function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const { host, hostname } = new URL(origin);
    if (host === new URL(request.url).host || hostname === "localhost" || hostname === "127.0.0.1") return true;
    return ["claude.ai", "claude.com", "anthropic.com"].some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** The whole Streamable HTTP POST: one message or a batch in, JSON out. */
export async function handlePost(server: McpServer, request: Request): Promise<Response> {
  if (!originAllowed(request)) {
    return json({ jsonrpc: "2.0", error: { code: INVALID_REQUEST, message: "Origin not allowed" } }, 403);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: PARSE_ERROR, message: "Parse error" } }, 400);
  }

  try {
    if (Array.isArray(body)) {
      // Batches only exist in 2025-03-26, before the version headers did.
      if (!body.length) return json({ jsonrpc: "2.0", id: null, error: { code: INVALID_REQUEST, message: "Empty batch" } }, 400);
      const replies = [];
      for (const msg of body) {
        const reply = await handleMessage(server, msg, null);
        if (reply.body) replies.push(reply.body);
      }
      return replies.length ? json(replies, 200) : new Response(null, { status: 202 });
    }
    const reply = await handleMessage(server, body, request.headers);
    return reply.body ? json(reply.body, reply.status) : new Response(null, { status: reply.status });
  } catch (err) {
    console.error("MCP request failed", err);
    return json({ jsonrpc: "2.0", id: null, error: { code: INTERNAL_ERROR, message: "Internal error" } }, 500);
  }
}
