import test from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { createCatalog, createHubServer, handleMcpMessage, runStdioServer } from "../packages/server/src/index.mjs";

const catalog = createCatalog();
const rpc = (method, params, id = 1) => handleMcpMessage(catalog, { jsonrpc: "2.0", id, method, params });

async function withServer(t) {
  const server = createHubServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (route) => {
    const response = await fetch(base + route);
    return { status: response.status, body: await response.json() };
  };
  return { base, get };
}

test("MCP initialize negotiates a supported protocol and advertises tools and resources", () => {
  const result = rpc("initialize", { protocolVersion: "2025-03-26" }).result;
  assert.equal(result.protocolVersion, "2025-03-26");
  assert.ok(result.capabilities.tools && result.capabilities.resources);
  assert.equal(rpc("initialize", { protocolVersion: "1999-01-01" }).result.protocolVersion, "2025-06-18");
  assert.equal(handleMcpMessage(catalog, { jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.deepEqual(rpc("tools/list").result.tools.map(tool => tool.name), ["search_skills", "get_skill"]);
});

test("MCP search_skills reports policy state and can restrict to installable skills", () => {
  const all = rpc("tools/call", { name: "search_skills", arguments: { query: "brainstorming" } }).result.structuredContent.items;
  const blocked = all.find(item => item.id === "obra/superpowers/brainstorming");
  assert.equal(blocked.availability.status, "blocked");
  assert.equal(blocked.install, null);
  const installable = rpc("tools/call", { name: "search_skills", arguments: { query: "design", installable_only: true } }).result.structuredContent.items;
  assert.ok(installable.length > 0);
  assert.ok(installable.every(item => item.availability.status === "eligible" && item.install));
  assert.equal(rpc("tools/call", { name: "search_skills", arguments: {} }).result.isError, true);
});

test("MCP get_skill returns SKILL.md only for released skills", () => {
  const released = rpc("tools/call", { name: "get_skill", arguments: { id: "anthropics/frontend-design", agent: "codex" } }).result.structuredContent;
  assert.match(released.skill_md, /^---/);
  assert.equal(released.install, "skills-hub install anthropics/frontend-design --agent codex");
  const held = rpc("tools/call", { name: "get_skill", arguments: { id: "anthropics/academy-guide" } }).result.structuredContent;
  assert.equal(held.skill_md, null);
  assert.deepEqual(held.files, []);
  assert.equal(rpc("tools/call", { name: "get_skill", arguments: { id: "nope/nope" } }).result.isError, true);
  assert.equal(rpc("tools/call", { name: "unknown" }).error.code, -32602);
});

test("MCP resources expose only files of released skills and reject traversal", () => {
  const resources = rpc("resources/list").result.resources;
  const ids = new Set(catalog.registry.skills.filter(s => s.release?.status === "eligible").map(s => s.id));
  assert.ok(resources.length > 0);
  assert.ok(resources.every(resource => [...ids].some(id => resource.uri.startsWith(`skillshub://skills/${id}/`))));
  const uri = "skillshub://skills/anthropics/internal-comms/SKILL.md";
  assert.match(rpc("resources/read", { uri }).result.contents[0].text, /name: internal-comms/);
  for (const bad of [
    "skillshub://skills/anthropics/internal-comms/../../../package.json",
    "skillshub://skills/anthropics/academy-guide/SKILL.md",
    "file:///etc/passwd"
  ]) assert.equal(rpc("resources/read", { uri: bad }).error.code, -32002, bad);
  assert.equal(rpc("no/such").error.code, -32601);
  assert.equal(handleMcpMessage(catalog, { id: 1 }).error.code, -32600);
});

test("MCP stdio transport answers line-delimited requests", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let text = "";
  output.on("data", chunk => { text += chunk; });
  const done = runStdioServer({ input, output });
  input.end('{"jsonrpc":"2.0","id":7,"method":"ping"}\nnot json\n');
  await done;
  const [ping, parseError] = text.trim().split("\n").map(line => JSON.parse(line));
  assert.deepEqual(ping, { jsonrpc: "2.0", id: 7, result: {} });
  assert.equal(parseError.error.code, -32700);
});

test("HTTP API serves health, filtered skills, details, and bundles", async t => {
  const { get } = await withServer(t);
  const health = await get("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.skills, catalog.registry.skills.length);
  const bundled = await get("/api/skills?distribution=bundled&limit=2");
  assert.equal(bundled.body.total, catalog.registry.skills.filter(s => s.distribution === "bundled").length);
  assert.equal(bundled.body.items.length, Math.min(2, bundled.body.total));
  assert.ok(bundled.body.items.every(item => item.distribution === "bundled"));
  const searched = await get("/api/skills?q=frontend%20design&agent=codex");
  assert.equal(searched.body.items[0].id, "anthropics/frontend-design");
  const azure = await get("/api/skills?q=azure&limit=1");
  assert.ok(azure.body.total > 100, "search totals are not capped by the page limit");
  const detail = await get("/api/skills/anthropics/frontend-design");
  assert.equal(detail.body.id, "anthropics/frontend-design");
  assert.equal((await get("/api/skills/nope/nope")).status, 404);
  assert.ok((await get("/api/bundles")).body.bundles["@frontend"]);
  assert.equal((await get("/api/bundles/@frontend?agent=codex")).body.bundle, "@frontend");
  assert.equal((await get("/api/bundles/@missing")).status, 404);
  assert.equal((await get("/api/unknown")).status, 404);
});

test("HTTP MCP endpoint accepts JSON-RPC posts and rejects other methods", async t => {
  const { base } = await withServer(t);
  const post = (body) => fetch(base + "/mcp", { method: "POST", headers: { "content-type": "application/json" }, body });
  const listed = await (await post(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }))).json();
  assert.equal(listed.result.tools.length, 2);
  assert.equal((await post(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }))).status, 202);
  assert.equal((await post("{")).status, 400);
  assert.equal((await fetch(base + "/mcp")).status, 405);
  assert.equal((await fetch(base + "/api/health", { method: "DELETE" })).status, 405);
});
