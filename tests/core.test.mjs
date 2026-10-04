import test from "node:test";
import assert from "node:assert/strict";
import { loadRegistry, resolveBundle, filterForAgent, findSkill, parseFrontmatter, compatibilityBasis } from "../packages/core/src/index.mjs";

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

test("Agent Skills format skills are compatible with standard agents only",()=>{
  const skill={id:"a/b",name:"b",compatibility:["agent-skills"]};
  for(const agent of ["claude-code","codex","cursor","github-copilot","copilot","opencode"]) assert.equal(compatibilityBasis(skill,agent),"standard",agent);
  // A generic agent accepts anything listed for agent-skills, of any artifact type.
  assert.equal(compatibilityBasis(skill,"generic-agent"),"listed");
  assert.equal(compatibilityBasis({...skill,artifact_type:"cli-tool"},"generic-agent"),"listed");
  // External installers need an explicit listing; only bundled files rely on the format.
  for(const distribution of ["source-direct","review-required","blocked"]) assert.equal(compatibilityBasis({...skill,distribution},"codex"),null,distribution);
  assert.equal(compatibilityBasis({...skill,distribution:"source-direct",compatibility:["agent-skills","codex"]},"codex"),"listed");
  assert.equal(compatibilityBasis({...skill,compatibility:["agent-skills","codex"]},"codex"),"listed");
  assert.equal(compatibilityBasis(skill,"some-other-agent"),null);
  assert.equal(compatibilityBasis({...skill,artifact_type:"mcp-server"},"codex"),null);
  assert.equal(compatibilityBasis({...skill,compatibility:["claude-code"]},"codex"),null);
  assert.equal(filterForAgent([skill],"claude-code").length,1);
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
  const broken=loadRegistry().skills.filter(skill=>/^[>|](?:[+-]?\d*|\d[+-])$/.test(String(skill.description??"").trim()));
  assert.deepEqual(broken.map(skill=>skill.id),[]);
});

test("parseFrontmatter reads next-line plain scalars, trailing comments, and indentation indicators", () => {
  const fm = (body) => parseFrontmatter(`---\n${body}\n---\n`);
  assert.equal(fm("description:\n  Use this when\n  needed.").description, "Use this when needed.");
  assert.equal(fm('description: "abc" # note').description, "abc");
  assert.equal(fm("description: 'it''s' # note").description, "it's");
  assert.equal(fm("description: >2-\n  hello\n  world").description, "hello world");
  assert.equal(fm("description: |-2\n  a\n  b").description, "a\nb");
  assert.equal(fm("description: foo\n  bar\n\n  baz").description, "foo bar\nbaz");
  assert.deepEqual(fm("metadata:\n  author: x\nname: y"), { name: "y" });
  assert.deepEqual(fm("tags:\n  - a"), {});
});

test("parseFrontmatter skips leading blank lines and comments in plain scalars", () => {
  const fm = (body) => parseFrontmatter(`---\n${body}\n---\n`);
  assert.equal(fm("description:\n\n  text here").description, "text here");
  assert.equal(fm("description:\n  # comment\n  text").description, "text");
  assert.equal(fm('description: "abc"\n  more').description, "abc");
});
