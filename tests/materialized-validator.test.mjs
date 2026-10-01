import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("materialized records have roots", () => {
  const registry=JSON.parse(fs.readFileSync("catalog/skills.json","utf8"));
  for(const skill of registry.skills){
    if(skill.materialized) assert.ok(skill.materialized_root,skill.id);
  }
});
