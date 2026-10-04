import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Builds the npm package into a temporary directory and checks that it is
// self-contained: no workspace imports, no development files, every released
// artifact with its manifest and review, and a CLI that runs from there.
test("the npm package build is self-contained and runs outside the repository", t => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "hub-package-"));
  t.after(() => fs.rmSync(out, { recursive: true, force: true }));
  const build = spawnSync(process.execPath, ["scripts/build-package.mjs", "--out", out], { encoding: "utf8" });
  assert.equal(build.status, 0, build.stderr);

  const pkg = JSON.parse(fs.readFileSync(path.join(out, "package.json"), "utf8"));
  assert.equal(pkg.name, "@axiomnode-lab/skills-hub");
  assert.deepEqual(pkg.bin, { "skills-hub": "packages/cli/bin/skills-hub.mjs" });
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ["@inquirer/prompts", "yaml"]);
  assert.ok(Object.values(pkg.dependencies).every(version => !version.startsWith("workspace:")));

  const files = [];
  const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); e.isDirectory() ? walk(f) : files.push(path.relative(out, f).split(path.sep).join("/")); } };
  walk(out);
  for (const file of files.filter(f => f.endsWith(".mjs"))) {
    assert.doesNotMatch(fs.readFileSync(path.join(out, file), "utf8"), /["']@ai-skills-hub\//, file);
  }
  for (const forbidden of [/^tests?\//, /\.test\.mjs$/, /^scripts\//, /^catalog\/ingestion\//, /^catalog\/sources\.json$/, /^docs\//, /^\.github\//, /node_modules/, /^pnpm-/]) {
    assert.equal(files.filter(f => forbidden.test(f)).length, 0, String(forbidden));
  }

  const registry = JSON.parse(fs.readFileSync(path.join(out, "catalog/skills.json"), "utf8"));
  const released = registry.skills.filter(s => s.distribution === "bundled" && s.materialized && s.release?.status === "eligible");
  assert.ok(released.length > 0);
  for (const skill of released) {
    const manifest = JSON.parse(fs.readFileSync(path.join(out, `catalog/materialized-manifests/${skill.id.replaceAll("/", "__")}.json`), "utf8"));
    assert.ok(fs.existsSync(path.join(out, manifest.review.path)), skill.id);
    for (const file of manifest.materialized_files) assert.ok(fs.existsSync(path.join(out, skill.materialized_root, file.path)), `${skill.id}/${file.path}`);
  }
  // Only released skills' reviews ship.
  assert.equal(files.filter(f => f.startsWith("catalog/reviews/")).length, released.length);

  // The CLI resolves the catalog from the package, not from the working directory.
  // Stand in for `npm install`: link each runtime dependency from the workspace package that declares it.
  for (const [name, owner] of [["yaml", "packages/core"], ["@inquirer/prompts", "packages/cli"]]) {
    const target = path.join(out, "node_modules", ...name.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(owner, "node_modules", ...name.split("/"))), target, process.platform === "win32" ? "junction" : "dir");
  }
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "hub-package-cwd-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const env = { ...process.env, SKILLS_HUB_HOME: "", SKILLS_HUB_NO_UPDATE_CHECK: "1" };
  delete env.SKILLS_HUB_HOME;
  const run = (...args) => spawnSync(process.execPath, [path.join(out, pkg.bin["skills-hub"]), ...args], { cwd, env, encoding: "utf8" });
  const version = run("--version");
  assert.equal(version.stdout.trim(), pkg.version);
  const info = run("info", released[0].id, "--json");
  assert.equal(info.status, 0, info.stderr);
  assert.equal(JSON.parse(info.stdout).hub_status.availability.status, "eligible");
});
