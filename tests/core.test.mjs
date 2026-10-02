import test from "node:test";
import assert from "node:assert/strict";
import { loadRegistry, resolveBundle, filterForAgent, findSkill, parseFrontmatter } from "../packages/core/src/index.mjs";

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

test("frontmatter parser reads folded and literal block scalars",()=>{
  const folded=parseFrontmatter("---\nname: a\ndescription: >\n  First line\n  second line.\n\n  Next paragraph.\nlicense: MIT\n---\nbody");
  assert.equal(folded.description,"First line second line.\nNext paragraph.\n");
  assert.equal(folded.license,"MIT");
  assert.equal(parseFrontmatter("---\ndescription: |-\n  L1\n  L2\n---").description,"L1\nL2");
  assert.equal(parseFrontmatter("---\ndescription: >-\n  one\n  two\n---").description,"one two");
});

test("frontmatter parser handles quotes, comments, continuations, and nested maps",()=>{
  const fields=parseFrontmatter("---\nname: \"x: y # z\"\ntitle: it's # note\ndescription: starts here\n  and continues\nmetadata:\n  author: someone\nallowed-tools: Read\n---");
  assert.deepEqual(fields,{name:"x: y # z",title:"it's",description:"starts here and continues","allowed-tools":"Read"});
  assert.equal(parseFrontmatter("---\ndescription: 'it''s'\n---").description,"it's");
  assert.deepEqual(parseFrontmatter("no frontmatter"),{});
});

test("catalog descriptions are not bare YAML block indicators",()=>{
  const broken=loadRegistry().skills.filter(skill=>/^[>|][+-]?\d*$/.test(String(skill.description??"").trim()));
  assert.deepEqual(broken.map(skill=>skill.id),[]);
});
