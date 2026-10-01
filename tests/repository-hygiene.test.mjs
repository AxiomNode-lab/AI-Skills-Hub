import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const forbiddenPaths = [
  "catalog/registry.json",
  "scripts/discover-skills.mjs",
  ".github/workflows/auto-discovery.yml",
  "scripts/generate-mcp-manifests.mjs",
  "docker-compose.yml"
];

for (const relative of forbiddenPaths) {
  test(`legacy artifact is absent: ${relative}`, () => {
    assert.equal(fs.existsSync(relative), false);
  });
}

test("repository does not contain fabricated MCP utility identifiers or local settings", () => {
  const roots = ["catalog", "capabilities-library", "packages", "scripts", "tests", ".github"];
  const matches = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        walk(full);
      } else if (entry.isFile()) {
        if (/settings\.local\.json$/i.test(entry.name)) matches.push(full);
        if (/\.(mjs|js|json|md|yml|yaml)$/.test(entry.name)) {
          const body = fs.readFileSync(full, "utf8");
          if (/mcp-util-\d+|Popular AI utility tool/i.test(body)) {
            matches.push(full);
          }
        }
      }
    }
  }

  roots.forEach(walk);
  assert.deepEqual(matches, []);
});
test("CLI source contains no shell-string execSync calls", () => {
  const matches = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && /\.mjs$/.test(entry.name)) {
        const body = fs.readFileSync(full, "utf8");
        if (/\bexecSync\s*\(/.test(body)) matches.push(full);
      }
    }
  }

  walk("packages/cli");
  assert.deepEqual(matches, []);
});
