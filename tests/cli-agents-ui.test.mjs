import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { detectAgents } from "../packages/installer/src/detector.mjs";
import { colorEnabled, paint } from "../packages/cli/src/ui.mjs";

const cli = fileURLToPath(new URL("../packages/cli/bin/skills-hub.mjs", import.meta.url));
const offline = "data:text/javascript,globalThis.fetch=async()=>{throw new Error('offline test')};";

function temp(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// A fake executable that the platform's PATH lookup accepts.
function fakeExecutable(dir, name) {
  const file = path.join(dir, process.platform === "win32" ? `${name}.cmd` : name);
  fs.writeFileSync(file, process.platform === "win32" ? "@echo off\r\n" : "#!/bin/sh\n");
  fs.chmodSync(file, 0o755);
}

test("agent detection finds executables on PATH and config directories on every platform", async t => {
  const home = temp(t, "hub-home-");
  const bin = temp(t, "hub-bin-");
  fakeExecutable(bin, "codex");
  fakeExecutable(bin, "claude");
  fs.mkdirSync(path.join(home, ".copilot"));
  const env = { PATH: bin, PATHEXT: ".EXE;.CMD", APPDATA: path.join(home, "AppData", "Roaming") };
  const agents = await detectAgents({ env, home });
  const byId = Object.fromEntries(agents.map(agent => [agent.id, agent]));
  for (const id of ["claude-code", "codex", "cursor", "github-copilot", "opencode", "agent-skills"]) assert.ok(byId[id], id);
  assert.equal(byId.codex.detected, true);
  assert.match(byId.codex.evidence, /codex/i);
  assert.equal(byId["claude-code"].detected, true);
  assert.equal(byId["github-copilot"].evidence, path.join(home, ".copilot"));
  assert.equal(byId.cursor.detected, false);
  assert.equal(byId.opencode.detected, false);
  assert.ok(agents.findIndex(a => a.id === "cursor") > agents.findIndex(a => a.id === "codex"), "detected agents are listed first");
  assert.equal(agents.at(-1).id, "agent-skills");
});

test("agent detection reports nothing detected on an empty machine but still lists every agent", async t => {
  const home = temp(t, "hub-home-");
  const agents = await detectAgents({ env: { PATH: "" }, home });
  assert.deepEqual(agents.filter(a => a.detected).map(a => a.id), ["agent-skills"]);
  assert.equal(agents.length, 6);
});

test("colors follow TTY, NO_COLOR, FORCE_COLOR and TERM=dumb", () => {
  const tty = { isTTY: true };
  assert.equal(colorEnabled(tty, {}), true);
  assert.equal(colorEnabled({ isTTY: false }, {}), false);
  assert.equal(colorEnabled(tty, { NO_COLOR: "1" }), false);
  assert.equal(colorEnabled(tty, { TERM: "dumb" }), false);
  assert.equal(colorEnabled({ isTTY: false }, { FORCE_COLOR: "1" }), true);
  assert.equal(paint("green", "ok", { isTTY: false }), "ok");
});

function run(t, args, env = {}) {
  const cwd = temp(t, "hub-cli-");
  const clean = { ...process.env, ...env };
  delete clean.SKILLS_HUB_HOME;
  if (env.FORCE_COLOR) delete clean.NO_COLOR;
  return { cwd, result: spawnSync(process.execPath, ["--import", offline, cli, ...args], { cwd, env: clean, encoding: "utf8" }) };
}

test("available lists only installable skills, per agent, without color codes when piped", t => {
  const { result } = run(t, ["available", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const all = JSON.parse(result.stdout);
  const catalog = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../catalog/skills.json", import.meta.url)), "utf8"));
  const eligible = catalog.skills.filter(s => s.release.status === "eligible" && s.materialized && s.distribution === "bundled").map(s => s.id).sort();
  assert.deepEqual(all.map(skill => skill.id).sort(), eligible);

  const claude = JSON.parse(run(t, ["available", "--agent", "claude-code", "--json"]).result.stdout);
  assert.equal(claude.length, all.length, "every released Agent Skills format skill installs for Claude Code");
  assert.ok(claude.some(s => s.id.startsWith("microsoft/") && s.compatibility_basis === "standard"));

  const text = run(t, ["available", "design", "--agent", "codex"]).result;
  assert.match(text.stdout, /installable skills for codex matching "design"/);
  assert.match(text.stdout, /anthropics\/frontend-design/);
  assert.doesNotMatch(text.stdout, /\x1b\[/);
  assert.match(run(t, ["available", "design"], { FORCE_COLOR: "1" }).result.stdout, /\x1b\[32m/);
});

test("search --installable hides skills that cannot be installed", t => {
  const all = JSON.parse(run(t, ["search", "brainstorming", "--json"]).result.stdout);
  assert.ok(all.some(s => s.hub_status.availability.status !== "eligible"));
  const installable = JSON.parse(run(t, ["search", "brainstorming", "--installable", "--json"]).result.stdout);
  assert.ok(installable.every(s => s.hub_status.availability.status === "eligible"));
});

test("search --installable ranks only installable skills, so --limit counts installable matches", t => {
  // For "review" the two best matches are not released; filtering after the
  // limit used to return nothing.
  const top = JSON.parse(run(t, ["search", "review", "--limit", "2", "--json"]).result.stdout);
  assert.ok(top.every(s => s.hub_status.availability.status !== "eligible"));
  const installable = JSON.parse(run(t, ["available", "review", "--json"]).result.stdout);
  assert.ok(installable.length >= 2);
  const limited = JSON.parse(run(t, ["search", "review", "--installable", "--limit", "2", "--json"]).result.stdout);
  assert.equal(limited.length, 2);
  assert.ok(limited.every(s => s.hub_status.availability.status === "eligible"));
});

test("unknown or invalid options fail with a usage error instead of becoming search text", t => {
  for (const args of [["search", "pdf", "--agnet", "codex"], ["search", "pdf", "--limit", "0"], ["serve", "--port", "http"]]) {
    const { result } = run(t, args);
    assert.equal(result.status, 2, args.join(" "));
    assert.match(result.stderr, /skills-hub help/);
  }
});

test("a Microsoft skill installs for Claude Code into .claude/skills via the Agent Skills format", t => {
  const { cwd, result } = run(t, ["install", "microsoft/wiki-qa", "--agent", "claude-code", "--json"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).success, true);
  assert.ok(fs.existsSync(path.join(cwd, ".claude", "skills", "wiki-qa", "SKILL.md")));
  assert.ok(fs.existsSync(path.join(cwd, ".claude", "skills", "wiki-qa", "LICENSE.txt")));
});

test("the update check asks npm for this package, is cached for a day, and skips development checkouts", async t => {
  const { checkForUpdates, compareVersions } = await import("../packages/cli/src/utils.mjs");
  const home = temp(t, "hub-update-home-");
  fs.writeFileSync(path.join(home, "package.json"), JSON.stringify({ name: "@axiomnode-lab/skills-hub", version: "0.3.0-beta.1" }));
  const cacheFile = path.join(temp(t, "hub-update-"), "update-check.json");
  const localPkgPath = path.join(home, "package.json");
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); return { ok: true, json: async () => ({ version: "0.3.0" }) }; };
  const logs = [];
  const error = console.error;
  console.error = (...args) => logs.push(args.join(" "));
  t.after(() => { console.error = error; });
  const run = (now) => checkForUpdates({ env: {}, isTTY: true, fetchImpl, now, cacheFile, localPkgPath });
  await run(1_000);
  await run(1_000 + 60_000);
  assert.deepEqual(urls, ["https://registry.npmjs.org/@axiomnode-lab%2fskills-hub/latest"], "a fresh cache answers without fetching");
  await run(1_000 + 25 * 60 * 60 * 1000);
  assert.equal(urls.length, 2, "a stale cache fetches again");
  assert.ok(logs.some(line => line.includes("0.3.0-beta.1 -> 0.3.0") && line.includes("npm install -g @axiomnode-lab/skills-hub@latest")));
  await checkForUpdates({ env: {}, isTTY: false, fetchImpl, now: 0, cacheFile, localPkgPath });
  assert.equal(urls.length, 2, "non-interactive output never checks");
  fs.writeFileSync(path.join(home, "package.json"), JSON.stringify({ name: "ai-skills-hub", version: "0.3.0-beta.1", private: true }));
  await checkForUpdates({ env: {}, isTTY: true, fetchImpl, now: 10 * 24 * 60 * 60 * 1000, cacheFile, localPkgPath });
  assert.equal(urls.length, 2, "a development checkout never checks npm");
  assert.ok(compareVersions("0.3.0", "0.3.0-beta.1") > 0);
  assert.ok(compareVersions("0.3.0-beta.2", "0.3.0-beta.10") < 0);
  assert.ok(compareVersions("0.2.9", "0.3.0-beta.1") < 0);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
});

test("release notices are listed by info and returned by install", t => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hub-notice-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env, SKILLS_HUB_HOME: path.dirname(path.dirname(path.dirname(path.dirname(cli)))), SKILLS_HUB_NO_UPDATE_CHECK: "1" };
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: "utf8" });
  const info = run("info", "microsoft/azure-ai-vision-imageanalysis-java");
  assert.match(info.stdout, /Notice:\s+Microsoft retires the Azure Vision Image Analysis API on 2028-09-25/);
  const installed = JSON.parse(run("install", "kdense/vaex", "--agent", "agent-skills", "--scope", "project", "--json").stdout);
  assert.equal(installed.results[0].installed, true);
  assert.equal(installed.results[0].notices[0].kind, "behavior");
});
