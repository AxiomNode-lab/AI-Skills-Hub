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
  assert.ok(all.length >= 166);
  const catalog = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../catalog/skills.json", import.meta.url)), "utf8"));
  const eligible = new Set(catalog.skills.filter(s => s.release.status === "eligible").map(s => s.id));
  assert.ok(all.every(skill => eligible.has(skill.id)));

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

test("a Microsoft skill installs for Claude Code into .claude/skills via the Agent Skills format", t => {
  const { cwd, result } = run(t, ["install", "microsoft/wiki-qa", "--agent", "claude-code", "--json"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).success, true);
  assert.ok(fs.existsSync(path.join(cwd, ".claude", "skills", "wiki-qa", "SKILL.md")));
  assert.ok(fs.existsSync(path.join(cwd, ".claude", "skills", "wiki-qa", "LICENSE.txt")));
});
