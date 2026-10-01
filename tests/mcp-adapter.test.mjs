import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MCPAdapter } from "../packages/installer/src/adapters/MCPAdapter.mjs";

test("MCP adapter rejects capabilities without explicit installation metadata", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-skills-hub-mcp-"));
  const adapter = new MCPAdapter({
    id: "demo/missing",
    name: "missing-mcp",
    type: "mcp-server"
  });

  await assert.rejects(
    adapter.install({ agent: "cursor", scope: "project", cwd: dir }),
    /no verified installation metadata/
  );
});

test("MCP adapter writes Cursor configuration atomically", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-skills-hub-mcp-"));
  const adapter = new MCPAdapter({
    id: "demo/docs",
    name: "docs",
    type: "mcp-server",
    installation: {
      method: "remote",
      type: "http",
      url: "https://example.com/mcp"
    }
  });

  const result = await adapter.install({
    agent: "cursor",
    scope: "project",
    cwd: dir
  });

  assert.equal(result.destination, path.join(dir, ".cursor", "mcp.json"));
  const config = JSON.parse(fs.readFileSync(result.destination, "utf8"));
  assert.equal(config.mcpServers.docs.url, "https://example.com/mcp");
  assert.equal(fs.existsSync(result.destination + ".tmp"), false);
});

test("MCP adapter rejects symbolic-link configuration targets", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-skills-hub-mcp-"));
  const cursorDir = path.join(dir, ".cursor");
  fs.mkdirSync(cursorDir, { recursive: true });
  const target = path.join(dir, "real.json");
  fs.writeFileSync(target, JSON.stringify({ mcpServers: {} }));
  fs.symlinkSync(target, path.join(cursorDir, "mcp.json"));

  const adapter = new MCPAdapter({
    id: "demo/docs",
    name: "docs",
    type: "mcp-server",
    installation: {
      method: "remote",
      type: "http",
      url: "https://example.com/mcp"
    }
  });

  await assert.rejects(
    adapter.install({ agent: "cursor", scope: "project", cwd: dir }),
    /symbolic-link/
  );
});
