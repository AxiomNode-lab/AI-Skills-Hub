import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { addOutcome } from "../packages/cli/src/commands/add.mjs";

const cli = fileURLToPath(new URL("../packages/cli/bin/skills-hub.mjs", import.meta.url));
const REV_A = "a".repeat(40);
const REV_B = "b".repeat(40);

// A temporary Hub (catalog, manifests, released files) and a separate project.
function hub(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "hub-lifecycle-home-"));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), "hub-lifecycle-project-"));
  t.after(() => { fs.rmSync(home, { recursive: true, force: true }); fs.rmSync(project, { recursive: true, force: true }); });
  const skills = [];
  const release = (name, { revision = REV_A, body = "v1", dependencies, status = "eligible" } = {}) => {
    const id = `test/${name}`;
    const root = path.join(home, "skills", "test", name);
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, "SKILL.md"), `---\nname: ${name}\ndescription: ${name} fixture ${body}\n---\n${body}\n`);
    const skill = {
      id, name, publisher: "test", artifact_type: "skill", description: `${name} fixture`, compatibility: ["codex", "agent-skills"],
      distribution: status === "eligible" ? "bundled" : "review-required", materialized: status === "eligible",
      materialized_root: `skills/test/${name}`, release: { status, reasons: status === "eligible" ? [] : ["manual_review_required"] },
      license: { spdx: "MIT", redistributable: true, status: "verified" }, security: { scan_status: "verified", risk: "low" },
      source: { repo: "test/repo", path: `skills/${name}`, revision }, ...(dependencies ? { dependencies } : {})
    };
    const bytes = fs.readFileSync(path.join(root, "SKILL.md"));
    fs.mkdirSync(path.join(home, "catalog", "materialized-manifests"), { recursive: true });
    fs.writeFileSync(path.join(home, "catalog", "materialized-manifests", `test__${name}.json`), JSON.stringify({ skill_id: id, source: skill.source, materialized_files: [{ path: "SKILL.md", bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") }] }));
    const index = skills.findIndex(s => s.id === id);
    if (index >= 0) skills[index] = skill; else skills.push(skill);
    fs.writeFileSync(path.join(home, "catalog", "skills.json"), JSON.stringify({ skills }));
    return skill;
  };
  const run = (...args) => {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: "utf8", env: { ...process.env, SKILLS_HUB_HOME: home, SKILLS_HUB_NO_UPDATE_CHECK: "1" } });
    let json = null;
    try { json = JSON.parse(result.stdout); } catch { /* not JSON */ }
    return { ...result, json };
  };
  const installed = name => path.join(project, ".agents", "skills", name);
  return { home, project, release, run, installed };
}

test("add reports success only when the adapter installed the capability", () => {
  for (const result of [
    { action: "adapter-pending", installed: false, reason: "no adapter" },
    { action: "source-direct", installed: false, requires_confirmation: true, reason: "explicit_confirmation_required" },
    { action: "hold", installed: false, reason: "manual_review_required" },
    { action: "blocked", installed: false },
    { action: "incompatible", installed: false },
    { action: "unsupported", installed: false },
    { action: "marketplace", installed: false, reason: "marketplace_added_plugin_installation_pending" },
    {}
  ]) {
    const outcome = addOutcome(result, "demo");
    assert.equal(outcome.ok, false, JSON.stringify(result));
    assert.match(outcome.message, /^Not installed: demo/);
  }
  assert.deepEqual(addOutcome({ action: "install", installed: true, destination: "/p/.agents/skills/demo" }, "demo"), { ok: true, message: "Installed demo → /p/.agents/skills/demo." });
  assert.equal(addOutcome({ action: "already-installed", installed: true }, "demo").ok, true);
});

test("usage errors exit 2 (JSON callers still get JSON), runtime failures exit 1", t => {
  const h = hub(t);
  h.release("alpha");
  for (const args of [["frobnicate"], ["search"], ["info"], ["install", "test/alpha", "--agent", "nope"], ["list", "--scope", "global"], ["search", "x", "--limit", "0"], ["install", "test/alpha", "--agent"], ["uninstall", "--json"]]) {
    assert.equal(h.run(...args).status, 2, args.join(" "));
  }
  const usage = h.run("install", "test/alpha", "--agent", "nope", "--json");
  assert.equal(usage.json.success, false);
  assert.equal(usage.json.usage_error, true);
  assert.equal(h.run("--version").stdout.trim(), JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8")).version);
  assert.equal(h.run("help").status, 0);
  assert.equal(h.run("install", "test/missing", "--agent", "codex", "--json").status, 1);
  // No command off a terminal prints help instead of waiting on a prompt.
  assert.equal(h.run().status, 2);
});

test("reinstalling the same revision is a no-op; unmanaged or modified folders need --force", t => {
  const h = hub(t);
  h.release("alpha");
  assert.equal(h.run("install", "test/alpha", "--agent", "codex", "--json").json.results[0].status, "success");
  const again = h.run("install", "test/alpha", "--agent", "codex", "--json");
  assert.equal(again.status, 0);
  assert.equal(again.json.results[0].status, "already-installed");

  fs.appendFileSync(path.join(h.installed("alpha"), "SKILL.md"), "\nmy edit\n");
  const modified = h.run("install", "test/alpha", "--agent", "codex", "--json");
  assert.equal(modified.status, 1);
  assert.match(modified.json.results[0].reason, /changed; pass --force/);
  assert.match(fs.readFileSync(path.join(h.installed("alpha"), "SKILL.md"), "utf8"), /my edit/, "the user's edit is kept");
  assert.equal(h.run("install", "test/alpha", "--agent", "codex", "--force", "--json").status, 0);
  assert.doesNotMatch(fs.readFileSync(path.join(h.installed("alpha"), "SKILL.md"), "utf8"), /my edit/);

  h.release("beta");
  fs.mkdirSync(h.installed("beta"), { recursive: true });
  fs.writeFileSync(path.join(h.installed("beta"), "notes.md"), "mine");
  const unmanaged = h.run("install", "test/beta", "--agent", "codex", "--json");
  assert.equal(unmanaged.status, 1);
  assert.match(unmanaged.json.results[0].reason, /not managed by AI Skills Hub/);
  assert.equal(fs.readFileSync(path.join(h.installed("beta"), "notes.md"), "utf8"), "mine");
});

test("a failed dependency stops its dependents; earlier successes are reported, not rolled back", t => {
  const h = hub(t);
  h.release("held", { status: "hold" });
  h.release("child", { dependencies: ["test/held"] });
  h.release("alpha");
  const result = h.run("install", "test/alpha,test/child", "--agent", "codex", "--json");
  assert.equal(result.status, 1);
  const byId = Object.fromEntries(result.json.results.map(r => [r.id, r]));
  assert.equal(byId["test/alpha"].installed, true);
  assert.equal(byId["test/held"].installed, false);
  assert.equal(byId["test/child"].status, "dependency-failed");
  assert.equal(fs.existsSync(h.installed("child")), false);
  assert.equal(fs.existsSync(h.installed("alpha")), true);
});

test("uninstall <id> removes only the managed directory and checks agent, scope and integrity", t => {
  const h = hub(t);
  h.release("alpha");
  h.release("beta");
  assert.equal(h.run("install", "test/alpha,test/beta", "--agent", "codex", "--json").status, 0);
  fs.writeFileSync(path.join(h.project, ".agents", "skills", "unrelated.md"), "keep");

  assert.equal(h.run("uninstall", "test/alpha", "--agent", "claude-code", "--json").json.reason, "installed_for_agent_codex");
  assert.equal(h.run("uninstall", "test/alpha", "--scope", "user", "--json").json.reason, "not_installed_in_scope");
  assert.equal(h.run("uninstall", "test/nope", "--json").status, 1);

  fs.appendFileSync(path.join(h.installed("alpha"), "SKILL.md"), "edit");
  const modified = h.run("uninstall", "test/alpha", "--json");
  assert.equal(modified.status, 1);
  assert.match(modified.json.reason, /changed; use --force/);
  assert.ok(fs.existsSync(h.installed("alpha")));
  assert.equal(h.run("uninstall", "test/alpha", "--force", "--json").status, 0);
  assert.equal(fs.existsSync(h.installed("alpha")), false);
  assert.ok(fs.existsSync(h.installed("beta")), "other installations stay");
  assert.equal(fs.readFileSync(path.join(h.project, ".agents", "skills", "unrelated.md"), "utf8"), "keep");
  const records = JSON.parse(fs.readFileSync(path.join(h.project, ".ai-skills-hub", "installed.json"), "utf8")).installed;
  assert.deepEqual(Object.keys(records), ["test/beta"]);

  // A forged record pointing outside the install root is refused.
  const state = path.join(h.project, ".ai-skills-hub", "installed.json");
  const forged = JSON.parse(fs.readFileSync(state, "utf8"));
  forged.installed["test/beta"].destination = h.project;
  fs.writeFileSync(state, JSON.stringify(forged));
  const escaped = h.run("uninstall", "test/beta", "--force", "--json");
  assert.equal(escaped.status, 1);
  assert.ok(fs.existsSync(h.installed("beta")));
});

test("update installs a newer released revision, and refuses held releases and local edits", t => {
  const h = hub(t);
  h.release("alpha");
  h.release("beta");
  assert.equal(h.run("install", "test/alpha,test/beta", "--agent", "codex", "--json").status, 0);

  const current = h.run("update", "--json");
  assert.equal(current.status, 0);
  assert.deepEqual(current.json.results.map(r => r.status), ["up-to-date", "up-to-date"]);

  h.release("alpha", { revision: REV_B, body: "v2" });
  const dry = h.run("update", "test/alpha", "--dry-run", "--json");
  assert.equal(dry.json.results[0].status, "update-available");
  assert.match(fs.readFileSync(path.join(h.installed("alpha"), "SKILL.md"), "utf8"), /v1/, "dry run changes nothing");
  const updated = h.run("update", "test/alpha", "--json");
  assert.equal(updated.status, 0);
  assert.equal(updated.json.results[0].status, "updated");
  assert.match(fs.readFileSync(path.join(h.installed("alpha"), "SKILL.md"), "utf8"), /v2/);
  const record = JSON.parse(fs.readFileSync(path.join(h.project, ".ai-skills-hub", "installed.json"), "utf8")).installed["test/alpha"];
  assert.equal(record.source.revision, REV_B);
  assert.equal(h.run("list", "--json").json.find(r => r.skill_id === "test/alpha").hub_status.installation.status, "installed");

  h.release("beta", { revision: REV_B, body: "v2", status: "hold" });
  const held = h.run("update", "test/beta", "--json");
  assert.equal(held.status, 1);
  assert.equal(held.json.results[0].status, "not-releasable");
  assert.match(fs.readFileSync(path.join(h.installed("beta"), "SKILL.md"), "utf8"), /v1/);

  h.release("alpha", { revision: "c".repeat(40), body: "v3" });
  fs.appendFileSync(path.join(h.installed("alpha"), "SKILL.md"), "edit");
  const edited = h.run("update", "test/alpha", "--json");
  assert.equal(edited.json.results[0].status, "modified");
  assert.match(fs.readFileSync(path.join(h.installed("alpha"), "SKILL.md"), "utf8"), /edit/);
  assert.equal(h.run("update", "test/alpha", "--force", "--json").json.results[0].status, "updated");
});

test("install refuses a released artifact whose files no longer match the manifest", t => {
  const h = hub(t);
  h.release("alpha");
  fs.appendFileSync(path.join(h.home, "skills", "test", "alpha", "SKILL.md"), "tampered");
  const result = h.run("install", "test/alpha", "--agent", "codex", "--json");
  assert.equal(result.status, 1);
  assert.match(result.json.results[0].reason, /does not match its manifest hash/);
  assert.equal(fs.existsSync(h.installed("alpha")), false);
});

test("dependencies resolve before dependents, and a cycle is an error", async () => {
  const { resolveDependencies } = await import("../packages/cli/src/utils.mjs");
  const caps = [{ id: "a", dependencies: ["b"] }, { id: "b", dependencies: ["c"] }, { id: "c" }, { id: "d" }];
  assert.deepEqual(resolveDependencies(["a", "d"], caps).map(c => c.id), ["c", "b", "a", "d"]);
  assert.throws(() => resolveDependencies(["x"], [{ id: "x", dependencies: ["y"] }, { id: "y", dependencies: ["x"] }]), /cycle: x -> y -> x/);
});

test("install and uninstall refuse an install path that goes through a symlink", t => {
  const h = hub(t);
  h.release("alpha");
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "hub-outside-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, path.join(h.project, ".agents"), process.platform === "win32" ? "junction" : "dir");
  const result = h.run("install", "test/alpha", "--agent", "codex", "--json");
  assert.equal(result.status, 1);
  assert.match(result.json.results[0].reason, /symbolic link/);
  assert.deepEqual(fs.readdirSync(outside), []);

  // A record whose root became a symlink after install is not followed on uninstall.
  fs.unlinkSync(path.join(h.project, ".agents"));
  assert.equal(h.run("install", "test/alpha", "--agent", "codex", "--json").status, 0);
  fs.renameSync(path.join(h.project, ".agents"), path.join(outside, "real-agents"));
  fs.symlinkSync(path.join(outside, "real-agents"), path.join(h.project, ".agents"), process.platform === "win32" ? "junction" : "dir");
  assert.equal(h.run("uninstall", "test/alpha", "--force", "--json").status, 1);
  assert.ok(fs.existsSync(path.join(outside, "real-agents", "skills", "alpha", "SKILL.md")));
});

test("bundle aliases are refused with an explicit reason, never expanded", t => {
  const h = hub(t);
  h.release("alpha");
  const result = h.run("install", "@frontend", "--agent", "codex", "--json");
  assert.equal(result.status, 1);
  assert.equal(result.json.results[0].reason, "bundle_aliases_not_supported");
});
