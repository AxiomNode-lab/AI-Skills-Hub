import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("all catalog records have explicit distribution state", () => {
  const registry = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
  const valid = new Set(["bundled", "source-direct", "review-required", "blocked"]);
  assert.ok(registry.skills.length >= 10);
  for (const skill of registry.skills) assert.ok(valid.has(skill.distribution), skill.id);
});

test("sensitive capability flags are booleans", () => {
  const registry = JSON.parse(fs.readFileSync("catalog/skills.json", "utf8"));
  for (const skill of registry.skills) {
    for (const key of ["network", "shell", "credentials"]) {
      assert.equal(typeof skill.security[key], "boolean", `${skill.id}: ${key}`);
    }
  }
});
