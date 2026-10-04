import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { loadRegistry } from "../packages/core/src/index.mjs";
import { createCatalog, createHubServer, handleMcpMessage } from "../packages/server/src/index.mjs";

function fixture(t) {
  const parent = path.resolve(".ai-skills-hub");
  fs.mkdirSync(parent, { recursive: true });
  const home = fs.mkdtempSync(path.join(parent, "server-security-"));
  const skill = structuredClone(loadRegistry().skills.find(s => s.id === "microsoft/wiki-qa"));
  for (const relative of [skill.materialized_root, skill.license.evidence, `catalog/materialized-manifests/${skill.id.replaceAll("/", "__")}.json`]) {
    fs.mkdirSync(path.dirname(path.join(home, relative)), { recursive: true });
    fs.cpSync(relative, path.join(home, relative), { recursive: true });
  }
  const previous = process.env.SKILLS_HUB_HOME;
  process.env.SKILLS_HUB_HOME = home;
  t.after(() => {
    if (previous === undefined) delete process.env.SKILLS_HUB_HOME;
    else process.env.SKILLS_HUB_HOME = previous;
    fs.rmSync(home, { recursive: true, force: true });
  });
  const root = path.join(home, skill.materialized_root);
  const catalog = createCatalog({ skills: [skill] });
  const uri = file => `skillshub://skills/${skill.id}/${file}`;
  return { home, root, skill, catalog, uri };
}

test("server refuses extra, changed and missing files and altered release evidence", t => {
  const f = fixture(t);
  assert.ok(f.catalog.detail(f.skill.id).skill_md);
  fs.writeFileSync(path.join(f.root, "private.txt"), "not reviewed");
  assert.equal(f.catalog.readResource(f.uri("private.txt")), null);
  assert.deepEqual(f.catalog.resources(), []);
  fs.unlinkSync(path.join(f.root, "private.txt"));
  const original = fs.readFileSync(path.join(f.root, "SKILL.md"));
  fs.appendFileSync(path.join(f.root, "SKILL.md"), "\nchanged");
  assert.equal(f.catalog.detail(f.skill.id).skill_md, null);
  fs.writeFileSync(path.join(f.root, "SKILL.md"), original);
  const license = fs.readFileSync(path.join(f.root, "LICENSE.txt"));
  fs.unlinkSync(path.join(f.root, "LICENSE.txt"));
  assert.deepEqual(f.catalog.resources(), []);
  fs.writeFileSync(path.join(f.root, "LICENSE.txt"), license);
  fs.appendFileSync(path.join(f.home, f.skill.license.evidence), " ");
  assert.deepEqual(f.catalog.resources(), []);
});

test("server refuses root and ancestor directory symlinks, including Windows junctions", t => {
  const f = fixture(t);
  for (const relative of [f.skill.materialized_root, path.dirname(f.skill.materialized_root)]) {
    const source = path.join(f.home, relative);
    const moved = source + "-original";
    fs.renameSync(source, moved);
    fs.symlinkSync(moved, source, process.platform === "win32" ? "junction" : "dir");
    assert.equal(f.catalog.detail(f.skill.id).skill_md, null);
    assert.equal(f.catalog.readResource(f.uri("SKILL.md")), null);
    fs.unlinkSync(source);
    fs.renameSync(moved, source);
  }
});

test("server refuses traversal, outside roots, blocked and held artifacts", t => {
  const f = fixture(t);
  for (const file of ["../LICENSE.txt", "..%2fLICENSE.txt", "..\\LICENSE.txt", "/SKILL.md"]) assert.equal(f.catalog.readResource(f.uri(file)), null);
  for (const changed of [{ distribution: "blocked" }, { release: { status: "hold" } }, { security: { scan_status: "pending" } }, { license: { status: "unknown" } }, { materialized_root: path.dirname(f.home) }]) {
    const catalog = createCatalog({ skills: [{ ...f.skill, ...changed }] });
    assert.equal(catalog.detail(f.skill.id).skill_md, null);
    assert.deepEqual(catalog.resources(), []);
  }
});

test("MCP rejects malformed params and tool argument types without exceptions", () => {
  const catalog = createCatalog();
  for (const params of [null, [], "bad"]) assert.equal(handleMcpMessage(catalog, { jsonrpc: "2.0", id: 1, method: "initialize", params }).error.code, -32602);
  for (const args of [{ query: "x", limit: -1 }, { query: "x", limit: 1.5 }, { query: "x", limit: "2" }, { query: "x", installable_only: "false" }, { query: "x", agent: "codex; echo injected" }]) {
    assert.equal(handleMcpMessage(catalog, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_skills", arguments: args } }).result.isError, true);
  }
});

test("HTTP rejects untrusted origins, rebinding hosts, bad paths, media types and protocol versions", async t => {
  const server = createHubServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const origin of ["https://attacker.example", "null", "http://127.0.0.1:1"]) {
    const r = await fetch(base + "/mcp", { method: "POST", headers: { origin }, body: '{}' });
    assert.equal(r.status, 403);
    assert.equal(r.headers.get("access-control-allow-origin"), null);
  }
  const rebound = await new Promise((resolve, reject) => {
    http.get(base + "/api/health", { headers: { host: "attacker.example" } }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on("error", reject);
  });
  assert.equal(rebound, 403);
  assert.equal((await fetch(base + "/api/health", { headers: { origin: base } })).status, 200);
  for (const route of ["/api/skills/%ZZ", "/api/skills?limit=-1", "/api/skills?offset=Infinity", "/api/skills?agent=codex%3Bwhoami"]) assert.equal((await fetch(base + route)).status, 400);
  assert.equal((await fetch(base + "/mcp", { method: "POST", body: '{}' })).status, 415);
  assert.equal((await fetch(base + "/mcp", { method: "POST", headers: { "content-type": "application/json", "mcp-protocol-version": "invalid" }, body: '{}' })).status, 400);
  const response = await fetch(base + "/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: null }) });
  assert.equal((await response.json()).error.code, -32602);
  const oversized = await fetch(base + "/mcp", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: "x".repeat(1024 * 1024) }) });
  assert.equal(oversized.status, 413);
});
