import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../packages/cli/bin/skills-hub.mjs", import.meta.url));
const offline = "data:text/javascript,globalThis.fetch=async()=>{throw new Error('offline test')};";

function project(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hub-any-dir-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env };
  delete env.SKILLS_HUB_HOME;
  const run = (...args) => spawnSync(process.execPath, ["--import", offline, cli, ...args], { cwd, env, encoding: "utf8" });
  return { cwd, run };
}

test("CLI reads the Hub catalog from a project directory without its own catalog", t => {
  const { run } = project(t);
  const result = run("search", "frontend design", "--json");
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(result.stdout).some(item => item.id === "anthropics/frontend-design"));
});

test("CLI installs a released Hub skill into an unrelated project directory", t => {
  const { cwd, run } = project(t);
  const result = run("install", "anthropics/frontend-design", "--agent", "codex", "--json");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).success, true);
  assert.ok(fs.existsSync(path.join(cwd, ".agents", "skills", "frontend-design", "SKILL.md")));
  const info = JSON.parse(run("info", "anthropics/frontend-design", "--agent", "codex", "--json").stdout);
  assert.equal(info.hub_status.installation.status, "installed");
  assert.match(info.skill_content, /^---/);
});

test("info exits non-zero for an unknown capability", t => {
  const { run } = project(t);
  const result = run("info", "no-such/capability-93821");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not found/);
});
