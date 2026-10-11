import { describe, expect, it } from "vitest";
import { handlePost, type McpServer } from "@/lib/mcp";
import { TOOLS, affordLabel, filterItems, overview, previewChange, shoppingList } from "@/lib/mcp-tools";
import { affordabilityIndex, buildPlan } from "@/lib/plan";
import type { ItemDTO, SettingsDTO } from "@/lib/types";

const echo: McpServer = {
  name: "test",
  title: "Test",
  version: "0.0.0",
  instructions: "Be nice.",
  tools: [
    {
      name: "echo",
      title: "Echo",
      description: "Says it back.",
      inputSchema: { type: "object" },
      annotations: { readOnlyHint: true },
      run: async (args) => ({ content: [{ type: "text", text: JSON.stringify(args) }] }),
    },
  ],
};

const MODERN = "2026-07-28";
const meta = { "io.modelcontextprotocol/protocolVersion": MODERN, "io.modelcontextprotocol/clientCapabilities": {} };

function post(body: unknown, headers: Record<string, string> = {}) {
  return handlePost(
    echo,
    new Request("https://house.example/api/mcp/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("legacy (initialize) clients", () => {
  it("negotiates a version it speaks, or offers its latest", async () => {
    const res = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "test" },
      instructions: "Be nice.",
    });
    expect(res.headers.get("mcp-session-id")).toBeNull();

    const old = await (await post({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2024-11-05" } })).json();
    expect(old.result.protocolVersion).toBe("2025-11-25");
  });

  it("accepts notifications with a bare 202", async () => {
    const res = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("lists and calls tools, without the run function", async () => {
    const list = await (await post({ jsonrpc: "2.0", id: 3, method: "tools/list" }, { "MCP-Protocol-Version": "2025-06-18" })).json();
    expect(list.result.tools).toEqual([
      { name: "echo", title: "Echo", description: "Says it back.", inputSchema: { type: "object" }, annotations: { readOnlyHint: true } },
    ]);
    const call = await (await post({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "echo", arguments: { a: 1 } } })).json();
    expect(call).toEqual({ jsonrpc: "2.0", id: 4, result: { content: [{ type: "text", text: '{"a":1}' }] } });
  });

  it("answers batches, leaving out notifications", async () => {
    const res = await post([
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "nope" },
    ]);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
    expect(body[1].error.code).toBe(-32601);
  });

  it("rejects bad JSON, unknown versions and foreign origins", async () => {
    expect((await post("{nope")).status).toBe(400);
    expect((await post({ jsonrpc: "2.0", id: 1, method: "ping" }, { "MCP-Protocol-Version": "1999-01-01" })).status).toBe(400);
    expect((await post({ jsonrpc: "2.0", id: 1, method: "ping" }, { Origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ jsonrpc: "2.0", id: 1, method: "ping" }, { Origin: "https://claude.ai" })).status).toBe(200);
  });

  it("calls an unknown tool a protocol error", async () => {
    const body = await (await post({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } })).json();
    expect(body.error.code).toBe(-32602);
  });
});

describe("modern (per-request metadata) clients", () => {
  const headers = { "MCP-Protocol-Version": MODERN, "Mcp-Method": "tools/call", "Mcp-Name": "echo" };

  it("serves server/discover and marks results complete", async () => {
    const res = await post(
      { jsonrpc: "2.0", id: 1, method: "server/discover", params: { _meta: meta } },
      { "MCP-Protocol-Version": MODERN, "Mcp-Method": "server/discover" },
    );
    const { result } = await res.json();
    expect(result.resultType).toBe("complete");
    expect(result.supportedVersions).toContain(MODERN);
    expect(result.supportedVersions).toContain("2025-11-25");
    expect(result._meta["io.modelcontextprotocol/serverInfo"].name).toBe("test");
  });

  it("lists tools with the caching terms modern clients require", async () => {
    const res = await post(
      { jsonrpc: "2.0", id: 6, method: "tools/list", params: { _meta: meta } },
      { "MCP-Protocol-Version": MODERN, "Mcp-Method": "tools/list" },
    );
    const { result } = await res.json();
    expect(result.tools.map((t: { name: string }) => t.name)).toEqual(["echo"]);
    expect(typeof result.ttlMs).toBe("number");
    expect(result.cacheScope).toBe("private");
  });

  it("calls tools when the headers agree with the body", async () => {
    const res = await post({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "echo", arguments: {}, _meta: meta } }, headers);
    expect(res.status).toBe(200);
    expect((await res.json()).result.content[0].text).toBe("{}");
  });

  it("rejects headers that disagree with the body", async () => {
    const res = await post(
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "echo", _meta: meta } },
      { ...headers, "Mcp-Name": "other" },
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(-32020);
  });

  it("names its versions when asked for one it doesn't speak", async () => {
    const res = await post(
      { jsonrpc: "2.0", id: 4, method: "ping", params: { _meta: { ...meta, "io.modelcontextprotocol/protocolVersion": "2099-01-01" } } },
      { "MCP-Protocol-Version": "2099-01-01" },
    );
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe(-32022);
    expect(error.data.supported).toContain(MODERN);
  });

  it("answers an unknown method with 404", async () => {
    const res = await post({ jsonrpc: "2.0", id: 5, method: "nope", params: { _meta: meta } }, { "MCP-Protocol-Version": MODERN });
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe(-32601);
  });
});

// ---------------------------------------------------------------------------

let seq = 0;
function item(over: Partial<ItemDTO>): ItemDTO {
  seq += 1;
  return {
    id: `i${seq}`,
    title: `Item ${seq}`,
    kind: "TASK",
    room: "WHOLE_HOUSE",
    priority: "WOULD_LIKE",
    status: "TODO",
    estimatedPrice: null,
    estimateMax: null,
    isQuote: false,
    actualPrice: null,
    assignee: null,
    dueDate: null,
    warrantyUntil: null,
    project: null,
    repeat: null,
    spawnedFromId: null,
    pinned: false,
    potCharge: null,
    links: [],
    notes: null,
    addedBy: "Sam",
    completedAt: null,
    completedBy: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    steps: [],
    quotes: [],
    comments: [],
    ...over,
  };
}

const settings: SettingsDTO = {
  budgetAvailable: 500,
  potTracked: true,
  monthlySaving: 300,
  members: ["Sam", "Alex"],
  movedInOn: null,
  lastPaydayOn: null,
  lastPaydayBy: null,
  workerSeenAt: null,
};

describe("the tools", () => {
  it("each have a JSON Schema object input and say whether they change anything", () => {
    for (const tool of TOOLS) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.$schema).toBeUndefined();
      expect(typeof tool.annotations.readOnlyHint).toBe("boolean");
    }
    expect(TOOLS.find((t) => t.name === "delete_item")!.annotations.destructiveHint).toBe(true);
  });

  it("explain bad arguments as a tool error Claude can fix", async () => {
    const add = TOOLS.find((t) => t.name === "add_items")!;
    const res = await add.run({ items: [{ title: "Tiles", room: "Kitchen" }] });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("room");

    const unknown = await add.run({ items: [{ title: "Tiles", cost: 40 }] });
    expect(unknown.isError).toBe(true);
    expect(unknown.content[0].text).toContain("cost");
  });

  it("filter like the list view, open first in plan order", () => {
    const tap = item({ title: "Fix tap", priority: "MUST_HAVE", room: "BATHROOM_1" });
    const tiles = item({ title: "Tiles", kind: "BUY", room: "BATHROOM_1", notes: "Topps Tiles, grey" });
    const sofa = item({ title: "Sofa", kind: "BUY", status: "DONE", completedAt: "2026-10-05T10:00:00.000Z" });
    const all = [tiles, sofa, tap];
    const base = { status: "open" as const, limit: 100 };
    expect(filterItems(all, base).map((i) => i.title)).toEqual(["Fix tap", "Tiles"]);
    expect(filterItems(all, { ...base, search: "topps" }).map((i) => i.title)).toEqual(["Tiles"]);
    expect(filterItems(all, { ...base, status: "all", kind: "BUY" }).map((i) => i.title)).toEqual(["Tiles", "Sofa"]);
    expect(filterItems(all, { ...base, room: "BATHROOM_1", priority: "MUST_HAVE" }).map((i) => i.title)).toEqual(["Fix tap"]);
  });

  it("describe affordability in words", () => {
    expect(affordLabel(0)).toMatch(/^now/);
    expect(affordLabel(null)).toMatch(/not at the current/);
    expect(affordLabel(2)).toMatch(/after 2 more months/);
    expect(affordLabel(undefined)).toBeUndefined();
  });

  it("preview a change to the plan without making it", () => {
    const boiler = item({ title: "Boiler", priority: "MUST_HAVE", estimatedPrice: 400 });
    const sofa = item({ title: "Sofa", kind: "BUY", estimatedPrice: 300 });
    const shed = item({ title: "Shed", priority: "SOMEDAY", estimatedPrice: 600 });
    const all = [boiler, sofa, shed];

    const must = previewChange(all, settings, { id: shed.id, priority: "MUST_HAVE" });
    expect(must.before).toMatchObject({ affordable: expect.stringMatching(/after 3 more months/), shortToday: 800 });
    expect(must.after).toMatchObject({ affordable: expect.stringMatching(/after 2 more months/) });
    expect(must.pushedBack).toEqual([
      { id: sofa.id, title: "Sofa", priority: "WOULD_LIKE", from: expect.stringMatching(/after 1 more month/), to: expect.stringMatching(/after 3 more/) },
    ]);

    const dropped = previewChange(all, settings, { id: boiler.id, drop: true });
    expect(dropped.after).toBe("left out of the plan");
    expect(dropped.broughtForward!.map((m) => m.title)).toEqual(["Sofa", "Shed"]);

    const fence = previewChange(all, settings, { title: "Fence", estimatedPrice: 200, pinned: true });
    expect(fence.before).toMatch(/not in the plan/);
    expect(fence.after).toMatchObject({ affordable: expect.stringMatching(/^now/), potLeftAfter: 300 });
    expect(fence.pushedBack!.map((m) => m.title)).toEqual(["Boiler", "Sofa", "Shed"]);

    expect(() => previewChange(all, settings, { id: "nope" })).toThrow(/No item with id nope/);
  });

  it("gather the shopping list, supplies inside jobs included", () => {
    const sofa = item({ title: "Sofa", kind: "BUY", estimatedPrice: 600, links: ["https://www.ikea.com/gb/en/p/kivik/"] });
    const kettle = item({ title: "Kettle", kind: "BUY", priority: "MUST_HAVE", estimatedPrice: 30, estimateMax: 45 });
    const ordered = item({ title: "Rug", kind: "BUY", status: "DOING", estimatedPrice: 80 });
    const step = (text: string, cost: number | null, link: string | null, done = false) => ({
      id: text,
      text,
      done,
      cost,
      link,
      notes: null,
      potCharge: null,
      doneAt: null,
    });
    const sockets = item({
      title: "Fit sockets",
      room: "KITCHEN",
      steps: [
        step("Buy faceplates", 24, "https://www.screwfix.com/p/faceplate/1"),
        step("Turn off the power", null, null),
        step("Buy back boxes", 9, null, true),
      ],
    });
    const all = [sofa, kettle, ordered, sockets];
    const afford = affordabilityIndex(buildPlan(all, settings));

    const list = shoppingList(all, afford);
    expect(list.items.map((e) => [e.title, e.cost, e.shop ?? null])).toEqual([
      ["Kettle", 45, null],
      ["Sofa", 600, "ikea.com"],
      ["Buy faceplates", 24, "screwfix.com"],
    ]);
    expect(list.items[2]).toMatchObject({ forJob: "Fit sockets", stepId: "Buy faceplates", itemId: sockets.id });
    expect(list.total).toBe(669);
    expect(list.byShop.map((s) => s.shop)).toEqual(["no shop linked", "ikea.com", "screwfix.com"]);

    expect(shoppingList(all, afford, { shop: "Screwfix" }).items.map((e) => e.title)).toEqual(["Buy faceplates"]);
    // £500 in the pot: the kettle (a must) fits, the sofa after it doesn't.
    expect(shoppingList(all, afford, { affordableNow: true }).items.map((e) => e.title)).toEqual(["Kettle", "Buy faceplates"]);
  });

  it("build the overview from the app's own plan", () => {
    const items = [
      item({ title: "Boiler", priority: "MUST_HAVE", estimatedPrice: 400 }),
      item({ title: "Rewire", estimatedPrice: 3000, estimateMax: 4000 }),
      item({ title: "Bin", kind: "BUY", status: "DONE", actualPrice: 30 }),
    ];
    const o = overview(items, settings);
    expect(o.household).toEqual(["Sam", "Alex"]);
    expect(o.counts).toMatchObject({ openJobs: 2, openToBuy: 0, done: 1 });
    expect(o.plan.entries!.map((e) => [e.title, e.cost, e.affordable?.split(" ")[0]])).toEqual([
      ["Boiler", 400, "now"],
      ["Rewire", 4000, expect.any(String)],
    ]);
    expect(o.money).toMatchObject({ pot: 500, monthlySaving: 300, mustHavesLeaveSpare: 100 });

    const untracked = overview(items, { ...settings, potTracked: false });
    expect(untracked.plan.entries![0].affordable).toBeUndefined();
    expect(untracked.money).toHaveProperty("note");
  });
});
