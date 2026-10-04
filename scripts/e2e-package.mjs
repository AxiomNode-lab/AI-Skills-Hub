#!/usr/bin/env node
// End-to-end test of the published artifact, run without the repository:
// build the package, `npm pack` it, install the tarball into a fresh temporary
// project, and run the user workflow there through the installed binary, npx,
// and a global (prefix) install. Fails on the first unexpected result.
//
// Usage: node scripts/e2e-package.mjs [--keep]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keep = process.argv.includes("--keep");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const work = fs.mkdtempSync(path.join(os.tmpdir(), "skills-hub-e2e-"));
const out = path.join(work, "package");
const project = path.join(work, "project");
const env = { ...process.env, SKILLS_HUB_NO_UPDATE_CHECK: "1", npm_config_update_notifier: "false", npm_config_fund: "false", npm_config_audit: "false" };
delete env.SKILLS_HUB_HOME;

const step = (name) => console.log(`\n== ${name}`);
const fail = (message) => { throw new Error(message); };
function run(command, args, { cwd = project, expect = 0, json = false } = {}) {
  // npm/npx are .cmd shims on Windows and need a shell there; arguments here are fixed strings.
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", shell: process.platform === "win32" && /\.cmd$/.test(command) });
  if (result.status !== expect) fail(`${command} ${args.join(" ")} exited ${result.status}, expected ${expect}\n${result.stdout}\n${result.stderr}`);
  return json ? JSON.parse(result.stdout) : result.stdout;
}

try {
  step("build and pack");
  execFileSync(process.execPath, [path.join(ROOT, "scripts/build-package.mjs"), "--out", out], { stdio: "inherit" });
  const packed = JSON.parse(run(npm, ["pack", "--json", "--pack-destination", work], { cwd: out }))[0];
  const tarball = path.join(work, packed.filename);
  console.log(`${packed.filename}: ${packed.size} bytes packed, ${packed.unpackedSize} unpacked, ${packed.entryCount} files`);
  const files = packed.files.map((f) => f.path);
  for (const forbidden of [/^tests?\//, /\.test\.mjs$/, /^scripts\//, /^docs\//, /^catalog\/ingestion\//, /node_modules\//, /^\.github\//, /\.env/]) {
    const hits = files.filter((f) => forbidden.test(f));
    if (hits.length) fail(`tarball contains ${forbidden}: ${hits.slice(0, 3).join(", ")}`);
  }
  for (const required of ["package.json", "packages/cli/bin/skills-hub.mjs", "catalog/skills.json", "skills/anthropics/frontend-design/SKILL.md", "catalog/materialized-manifests/anthropics__frontend-design.json"]) {
    if (!files.includes(required)) fail(`tarball is missing ${required}`);
  }

  step("install the tarball into a clean project");
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "e2e-project", private: true }));
  run(npm, ["install", "--no-save", tarball]);
  const bin = path.join(project, "node_modules", ".bin", process.platform === "win32" ? "skills-hub.cmd" : "skills-hub");
  const hub = (args, options = {}) => run(bin, args, options);

  step("--help / --version");
  if (!hub(["--help"]).includes("skills-hub <command>")) fail("help text missing");
  if (hub(["--version"]).trim() !== packed.version) fail("version mismatch");

  step("available / search / info");
  if (!/installable skills for codex/.test(hub(["available", "--agent", "codex"]))) fail("available output");
  const found = hub(["search", "frontend design", "--agent", "codex", "--json"], { json: true });
  if (found[0]?.id !== "anthropics/frontend-design") fail("search did not rank anthropics/frontend-design first");
  const info = hub(["info", "anthropics/frontend-design", "--agent", "codex", "--json"], { json: true });
  if (info.hub_status.availability.status !== "eligible") fail("info availability");

  step("install / list / reinstall / uninstall");
  const installed = hub(["install", "anthropics/frontend-design", "--agent", "codex", "--scope", "project", "--json"], { json: true });
  if (!installed.success) fail("install failed");
  if (!fs.existsSync(path.join(project, ".agents", "skills", "frontend-design", "SKILL.md"))) fail("SKILL.md not installed");
  const state = JSON.parse(fs.readFileSync(path.join(project, ".ai-skills-hub", "installed.json"), "utf8"));
  if (!state.installed["anthropics/frontend-design"]) fail("installation record missing");
  const listed = hub(["list", "--agent", "codex", "--scope", "project", "--json"], { json: true });
  if (listed[0]?.hub_status?.installation?.status !== "installed") fail("list status");
  if (hub(["install", "anthropics/frontend-design", "--agent", "codex", "--json"], { json: true }).results[0].status !== "already-installed") fail("reinstall is not a no-op");
  if (hub(["update", "--json"], { json: true }).results[0].status !== "up-to-date") fail("update status");
  hub(["install", "obra/superpowers/brainstorming", "--agent", "codex", "--json"], { expect: 1 });
  hub(["frobnicate"], { expect: 2 });
  hub(["uninstall", "anthropics/frontend-design", "--agent", "codex", "--json"], { json: true });
  if (fs.existsSync(path.join(project, ".agents", "skills", "frontend-design"))) fail("uninstall left the folder");

  step("mcp over stdio from the package");
  const mcp = spawnSync(bin, ["mcp"], { cwd: project, env, encoding: "utf8", shell: process.platform === "win32", input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_skill", arguments: { id: "anthropics/frontend-design" } } }) + "\n" });
  const reply = JSON.parse(mcp.stdout.trim().split("\n")[0]);
  if (!reply.result?.structuredContent?.skill_md) fail("MCP get_skill did not return the verified SKILL.md");

  step("npx from the tarball");
  const npxCache = path.join(work, "npx-cache");
  const viaNpx = run(npx, ["--yes", "--cache", npxCache, "--package", tarball, "skills-hub", "--version"], { cwd: work });
  if (viaNpx.trim() !== packed.version) fail("npx version mismatch");

  step("global install (prefix) from the tarball");
  const prefix = path.join(work, "global");
  run(npm, ["install", "-g", "--prefix", prefix, tarball], { cwd: work });
  const globalBin = process.platform === "win32" ? path.join(prefix, "skills-hub.cmd") : path.join(prefix, "bin", "skills-hub");
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "skills-hub-e2e-global-"));
  const globalInstall = run(globalBin, ["install", "anthropics/frontend-design", "--agent", "claude-code", "--json"], { cwd: elsewhere, json: true });
  if (!globalInstall.success || !fs.existsSync(path.join(elsewhere, ".claude", "skills", "frontend-design", "SKILL.md"))) fail("global install did not work");
  fs.rmSync(elsewhere, { recursive: true, force: true });

  console.log(`\nE2E passed: ${packed.name}@${packed.version} (${packed.size} bytes packed, ${packed.entryCount} files)`);
} finally {
  if (keep) console.log(`Kept ${work}`);
  else fs.rmSync(work, { recursive: true, force: true });
}
