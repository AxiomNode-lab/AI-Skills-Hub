import test from "node:test";
import assert from "node:assert/strict";
import { loadRegistry, resolveBundle, filterForAgent, findSkill } from "../packages/core/src/index.mjs";

test("registry contains no broken bundle references",()=>{
  const registry=loadRegistry();
  for(const name of Object.keys(registry.bundles??{})) assert.doesNotThrow(()=>resolveBundle(registry,name),name);
});

test("skill identity resolves by id and name",()=>{
  const registry=loadRegistry();
  const skill=registry.skills[0];
  assert.equal(findSkill(registry,skill.id)?.id,skill.id);
  assert.equal(findSkill(registry,skill.name)?.id,skill.id);
});

test("generic Agent Skills compatibility does not leak into named agents",()=>{
  const registry=loadRegistry();
  const docs=resolveBundle(registry,"@documents");
  assert.equal(filterForAgent(docs,"codex").length,0);
  assert.ok(filterForAgent(docs,"claude-code").length>=1);
});

test("@all bundle is a catalog snapshot with no unknown ids",()=>{
  const registry=loadRegistry();
  const all=resolveBundle(registry,"@all");
  assert.equal(all.length,registry.skills.length);
});
