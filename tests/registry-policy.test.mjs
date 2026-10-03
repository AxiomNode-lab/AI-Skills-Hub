import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("all catalog records have explicit distribution state", () => {
  const registry = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
  const valid = new Set(["bundled", "source-direct", "review-required", "blocked"]);
  assert.ok(registry.skills.length >= 10);
  for (const skill of registry.skills) assert.ok(valid.has(skill.distribution), skill.id);
});

test("capability flags are boolean when scanned and null when pending", () => {
  const registry = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
  for (const skill of registry.skills) {
    for (const key of ["network", "shell", "credentials"]) {
      const value = skill.security[key];
      assert.ok(value === null || typeof value === "boolean", skill.id + ": " + key);
    }
  }
});


test("current catalog keeps source-direct OpenAI artifacts non-redistributable",()=>{
  const registry=JSON.parse(fs.readFileSync("catalog/skills.json","utf8"));
  for(const skill of registry.skills.filter((s)=>s.id.startsWith("openai/"))){
    assert.equal(skill.license.spdx,"Proprietary",skill.id);
    assert.equal(skill.distribution,"source-direct",skill.id);
  }
});

test("release eligibility implies completed security verification",()=>{
  const registry=JSON.parse(fs.readFileSync("catalog/skills.json","utf8"));
  for(const skill of registry.skills.filter((s)=>s.release?.status==="eligible")){
    assert.equal(skill.materialized,true,skill.id);
    assert.equal(skill.security.scan_status,"verified",skill.id);
  }
});

test("release eligibility requires every declared skill dependency to be eligible", t => {
  const registry = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
  const eligible = registry.skills.find(skill => skill.release?.status === "eligible");
  const blocked = registry.skills.find(skill => skill.distribution === "blocked");
  const temporaryRoot = path.join(process.cwd(), ".ai-skills-hub");
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const dir = fs.mkdtempSync(path.join(temporaryRoot, "dependency-policy-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "catalog"), { recursive: true });
  fs.writeFileSync(path.join(dir, "catalog", "skills.json"), JSON.stringify({ skills: [{ ...eligible, dependencies: [blocked.id] }, blocked] }));
  fs.writeFileSync(path.join(dir, "catalog", "bundles.json"), JSON.stringify({ bundles: {} }));
  fs.writeFileSync(path.join(dir, "catalog", "skills.lock.json"), JSON.stringify({ skills: [{ id: eligible.id, revision: eligible.source.revision }] }));
  const result = spawnSync(process.execPath, [path.resolve("scripts/validate-registry.mjs")], { cwd: dir, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /release dependency is not eligible/);
});

test("using-superpowers remains held while its required brainstorming skill is blocked", () => {
  const registry = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
  const skill = registry.skills.find(item => item.id === "obra/using-superpowers");
  const dependency = registry.skills.find(item => item.id === "obra/superpowers/brainstorming");
  assert.deepEqual(skill.dependencies, [dependency.id]);
  assert.equal(skill.distribution, "review-required");
  assert.equal(skill.materialized, false);
  assert.equal(skill.release.status, "hold");
  assert.equal(dependency.distribution, "blocked");
});
