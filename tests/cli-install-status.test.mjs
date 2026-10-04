import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installCapability } from "../packages/cli/src/install-executor.mjs";

const cli = fileURLToPath(new URL("../packages/cli/bin/skills-hub.mjs", import.meta.url));
const brainstorming = "obra/superpowers/brainstorming";

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hub-install-status-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const source = path.join(cwd, "source");
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, "SKILL.md"), "---\nname: local-skill\ndescription: Local test fixture\n---\n");
  const base = {
    id: "test/local-skill", name: "local-skill", artifact_type: "skill",
    description: "Local fixture", compatibility: ["codex"], distribution: "bundled",
    materialized: true, materialized_root: source, release: { status: "eligible" },
    license: { spdx: "MIT" }, source: { repo: "test/fixture", path: "skill", revision: "0".repeat(40) }
  };
  const skills = [
    base,
    { ...base, id: brainstorming, name: "brainstorming", materialized: false, release: { status: "pending" } },
    { ...base, id: "test/review", name: "review", distribution: "review-required", release: { status: "hold" } },
    { ...base, id: "test/external", name: "external", distribution: "source-direct", materialized: false },
    { ...base, id: "test/blocked", name: "blocked", distribution: "blocked" },
    { ...base, id: "test/broken", name: "broken", materialized_root: path.join(cwd, "missing-source") }
  ];
  fs.mkdirSync(path.join(cwd, "catalog"));
  const catalog = path.join(cwd, "catalog", "skills.json");
  // Every materialized fixture gets a release manifest over its current files.
  const writeManifests = () => {
    const dir = path.join(cwd, "catalog", "materialized-manifests");
    fs.mkdirSync(dir, { recursive: true });
    for (const skill of skills.filter(s => s.materialized && fs.existsSync(s.materialized_root))) {
      const files = fs.readdirSync(skill.materialized_root).sort().map(file => {
        const bytes = fs.readFileSync(path.join(skill.materialized_root, file));
        return { path: file, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
      });
      fs.writeFileSync(path.join(dir, skill.id.replaceAll("/", "__") + ".json"), JSON.stringify({ skill_id: skill.id, source: skill.source, materialized_files: files }));
    }
  };
  const save = () => { fs.writeFileSync(catalog, JSON.stringify({ skills })); writeManifests(); };
  save();
  const preload = path.join(cwd, "offline.mjs");
  fs.writeFileSync(preload, `
    import cp from 'node:child_process';
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    globalThis.fetch = async () => { throw new Error('Tests must stay offline'); };
    cp.execFileSync = (command, args, options) => {
      if (process.env.HUB_TEST_EXTERNAL !== 'mock') throw new Error('Unexpected external installer');
      fs.writeFileSync('external-call.json', JSON.stringify({ command, args, options }));
      return Buffer.from('external installer output, not JSON');
    };
    syncBuiltinESMExports();
  `);
  const run = (args, extraEnv = {}) => {
    const result = spawnSync(process.execPath, ["--import", pathToFileURL(preload).href, cli, ...args], {
      cwd, encoding: "utf8", env: { ...process.env, SKILLS_HUB_HOME: cwd, ...extraEnv }
    });
    assert.ifError(result.error);
    return result;
  };
  const json = (args, exit = 0, extraEnv = {}) => {
    const result = run([...args, "--json"], extraEnv);
    assert.equal(result.status, exit, result.stdout + result.stderr);
    assert.equal(result.stderr, "");
    return JSON.parse(result.stdout);
  };
  const install = (ids, exit = 0, flags = []) => json(["install", ids, "--agent", "codex", "--scope", "project", ...flags], exit);
  return { cwd, skills, save, run, json, install };
}

test("unreleased brainstorming is held with a false JSON result and no installed files", t => {
  const f = fixture(t);
  const result = f.install(brainstorming, 1, ["--yes"]);
  assert.equal(result.success, false);
  assert.equal(result.results[0].installed, false);
  assert.equal(result.results[0].reason, "bundle_not_released");
  assert.equal(fs.existsSync(path.join(f.cwd, ".agents")), false);
  assert.deepEqual(f.json(["list", "--agent", "codex"]), []);
  const normal = f.run(["install", brainstorming, "--agent", "codex"]);
  assert.equal(normal.status, 1);
  assert.match(normal.stdout, /Installation incomplete/);
  assert.doesNotMatch(normal.stdout, /Installation complete\./);
  assert.match(normal.stderr, /bundle_not_released/);
});

test("external installation requires consent and never executes without it", t => {
  const f = fixture(t);
  const result = f.install("test/external", 1);
  assert.equal(result.success, false);
  assert.equal(result.results[0].status, "confirmation-required");
  assert.equal(result.results[0].requires_confirmation, true);
  assert.equal(result.results[0].reason, "explicit_confirmation_required");
  assert.equal(fs.existsSync(path.join(f.cwd, "external-call.json")), false);
  assert.deepEqual(f.json(["list"]), []);
});

test("review, blocked, and incompatible skills remain uninstalled even with --yes", t => {
  const f = fixture(t);
  const result = f.install("test/review,test/blocked", 1, ["--yes"]);
  assert.equal(result.success, false);
  assert.deepEqual(result.results.map(x => x.reason), ["manual_review_required", "registry_blocked"]);
  const incompatible = f.json(["install", "test/local-skill", "--agent", "cursor", "--yes"], 1);
  assert.equal(incompatible.results[0].reason, "agent_not_supported");
  assert.equal(fs.existsSync(path.join(f.cwd, ".agents")), false);
});

test("search and info distinguish catalog availability from installation evidence", t => {
  const f = fixture(t);
  const before = fs.readFileSync(path.join(f.cwd, "catalog", "skills.json"), "utf8");
  for (const [id, availability] of [[brainstorming, "catalog-only"], ["test/review", "review-required"], ["test/local-skill", "eligible"], ["test/external", "source-direct"], ["test/blocked", "blocked"]]) {
    const info = f.json(["info", id, "--agent", "codex"]);
    assert.equal(info.hub_status.availability.status, availability);
    assert.equal(info.hub_status.installation.status, "not-recorded");
    const search = f.json(["search", id, "--agent", "codex"]).find(x => x.id === id);
    assert.deepEqual(search.hub_status, info.hub_status);
    for (const command of ["info", "search"]) {
      const normal = f.run([command, id, "--agent", "codex"]);
      assert.equal(normal.status, 0);
      assert.match(normal.stdout, new RegExp(`Availability: ${availability}`));
      assert.match(normal.stdout, /Installation: not-recorded/);
    }
  }
  assert.equal(fs.readFileSync(path.join(f.cwd, "catalog", "skills.json"), "utf8"), before);
});

test("a successful local project install is verified by search, info, and list", t => {
  const f = fixture(t);
  const result = f.install("test/local-skill");
  assert.equal(result.success, true);
  assert.equal(result.results[0].installed, true);
  const destination = path.join(f.cwd, ".agents", "skills", "local-skill");
  assert.equal(result.results[0].destination, destination);
  assert.ok(fs.existsSync(path.join(destination, "SKILL.md")));
  const info = f.json(["info", "test/local-skill", "--agent", "codex"]);
  assert.equal(info.hub_status.availability.status, "eligible");
  assert.equal(info.hub_status.installation.status, "installed");
  assert.equal(info.release.status, "eligible");
  assert.equal(f.json(["search", "local-skill", "--agent", "codex"])[0].hub_status.installation.status, "installed");
  assert.equal(f.json(["list", "--agent", "codex"])[0].hub_status.installation.status, "installed");
  assert.match(f.run(["list", "--agent", "codex"]).stdout, /Installation: installed/);
  assert.equal(f.json(["info", "test/local-skill", "--agent", "cursor"]).hub_status.installation.status, "not-recorded");
  assert.deepEqual(f.json(["list", "--agent", "cursor"]), []);
});

test("stale or modified install records are shown as unverified, not installed", t => {
  const f = fixture(t);
  f.install("test/local-skill");
  const skillFile = path.join(f.cwd, ".agents", "skills", "local-skill", "SKILL.md");
  fs.appendFileSync(skillFile, "changed");
  let status = f.json(["info", "test/local-skill"]).hub_status.installation;
  assert.equal(status.status, "unverified");
  assert.equal(status.reason, "file_hash_changed");
  assert.equal(f.json(["search", "local-skill"])[0].hub_status.installation.status, "unverified");
  fs.unlinkSync(skillFile);
  status = f.json(["list"])[0].hub_status.installation;
  assert.equal(status.status, "unverified");
  assert.equal(status.reason, "file_count_changed");
});

test("mixed successful and skipped installs report overall failure and each outcome", t => {
  const f = fixture(t);
  const result = f.install(`test/local-skill,${brainstorming}`, 1);
  assert.equal(result.success, false);
  assert.deepEqual(result.results.map(x => x.installed), [true, false]);
  assert.equal(f.json(["list"]).length, 1);
});

test("multiple successful local installs return overall success", t => {
  const f = fixture(t);
  f.skills.push({ ...f.skills[0], id: "test/second-skill", name: "second-skill" });
  f.save();
  const result = f.install("test/local-skill,test/second-skill");
  assert.equal(result.success, true);
  assert.deepEqual(result.results.map(x => x.installed), [true, true]);
  assert.equal(f.json(["list"]).length, 2);
});

test("records without file evidence cannot establish installation", t => {
  const f = fixture(t);
  f.install("test/local-skill");
  const stateFile = path.join(f.cwd, ".ai-skills-hub", "installed.json");
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  state.installed["test/local-skill"].files = [];
  fs.writeFileSync(stateFile, JSON.stringify(state));
  assert.equal(f.json(["info", "test/local-skill"]).hub_status.installation.status, "unverified");
  assert.equal(f.json(["list"])[0].hub_status.installation.reason, "record_has_no_verifiable_skill_files");
  state.installed["test/local-skill"].scope = "user";
  fs.writeFileSync(stateFile, JSON.stringify(state));
  assert.equal(f.json(["info", "test/local-skill"]).hub_status.installation.status, "not-recorded");
  assert.deepEqual(f.json(["list"]), []);
});

test("external execution errors produce a structured failure", t => {
  const f = fixture(t);
  const result = f.install("test/external", 1, ["--yes"]);
  assert.equal(result.success, false);
  assert.equal(result.results[0].status, "error");
  assert.equal(result.results[0].installed, false);
  assert.match(result.results[0].reason, /Unexpected external installer/);
});

test("all requested local installs must succeed, including resolved dependencies", t => {
  const f = fixture(t);
  f.skills[0].dependencies = ["test/broken"];
  f.save();
  const result = f.install("test/local-skill", 1);
  assert.equal(result.success, false);
  assert.equal(result.results.find(x => x.id === "test/broken").status, "error");
  assert.match(result.results.find(x => x.id === "test/broken").reason, /Materialized root not found/);
});

test("missing IDs and dependencies produce per-item JSON failures without installing", t => {
  const f = fixture(t);
  const result = f.install("test/local-skill,test/missing", 1);
  assert.equal(result.success, false);
  assert.deepEqual(result.results.map(x => x.status), ["skipped", "not-found"]);
  f.skills[0].dependencies = ["test/missing-dependency"];
  f.save();
  const dependencyResult = f.install("test/local-skill", 1);
  assert.equal(dependencyResult.success, false);
  assert.equal(dependencyResult.results[1].reason, "capability_not_found");
  assert.equal(fs.existsSync(path.join(f.cwd, ".agents")), false);
});

test("invalid install requests and missing catalogs still return JSON failure", t => {
  const f = fixture(t);
  for (const args of [["install"], ["install", "test/local-skill"], ["install", "test/local-skill", "--agent", "codex", "--scope", "invalid"]]) {
    const result = f.json(args, 2);
    assert.equal(result.success, false);
    assert.ok(result.error);
  }
  fs.unlinkSync(path.join(f.cwd, "catalog", "skills.json"));
  assert.equal(f.install("test/local-skill", 1).success, false);
});

test("JSON external execution captures subprocess output and marketplace setup is not installation", t => {
  const f = fixture(t);
  const external = f.json(["install", "test/external", "--agent", "codex", "--yes"], 0, { HUB_TEST_EXTERNAL: "mock" });
  assert.equal(external.success, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.cwd, "external-call.json"))).options.stdio, ["ignore", "pipe", "pipe"]);
  assert.equal(f.json(["info", "test/external"]).hub_status.installation.status, "not-recorded");
  f.skills.push({ id: "test/plugin", name: "plugin", artifact_type: "agent-plugin", source: { repo: "test/plugins" } });
  f.save();
  const plugin = f.json(["install", "test/plugin", "--agent", "codex", "--yes"], 1, { HUB_TEST_EXTERNAL: "mock" });
  assert.equal(plugin.success, false);
  assert.equal(plugin.results[0].installed, false);
  assert.equal(plugin.results[0].reason, "marketplace_added_plugin_installation_pending");
});

test("native adapter respects the explicit project cwd", async t => {
  const f = fixture(t);
  const saved = process.env.SKILLS_HUB_HOME;
  process.env.SKILLS_HUB_HOME = f.cwd;
  t.after(() => { if (saved === undefined) delete process.env.SKILLS_HUB_HOME; else process.env.SKILLS_HUB_HOME = saved; });
  const result = await installCapability(f.skills[0], { agent: "codex", scope: "project", cwd: f.cwd });
  assert.equal(result.installed, true);
  assert.equal(result.destination, path.join(f.cwd, ".agents", "skills", "local-skill"));
});
