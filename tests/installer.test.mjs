import test from "node:test";
import assert from "node:assert/strict";
import { buildInstallPlan } from "../packages/installer/src/index.mjs";

const base={id:"demo/skill",name:"demo-skill",license:{spdx:"MIT"},source:{repo:"demo/repo",path:"skills/demo-skill"}};

test("unreleased bundled skill is held instead of bypassing release gates",()=>{
  const plan=buildInstallPlan([{...base,distribution:"bundled",materialized:false,release:{status:"pending"},compatibility:["agent-skills","codex"]}],"codex");
  assert.equal(plan[0].action,"hold");
  assert.equal(plan[0].reason,"bundle_not_released");
});

test("source-direct skill never becomes registry install",()=>{
  const plan=buildInstallPlan([{...base,distribution:"source-direct"}],"claude-code");
  assert.equal(plan[0].action,"source-direct");
  assert.ok(plan[0].command);
});

test("blocked skill cannot be installed",()=>{
  const plan=buildInstallPlan([{...base,distribution:"blocked"}],"codex");
  assert.equal(plan[0].action,"blocked");
  assert.equal(plan[0].command,null);
});


test("incompatible agent is rejected before install resolution",()=>{
  const plan=buildInstallPlan([{...base,distribution:"source-direct",compatibility:["agent-skills","claude-code"]}],"codex");
  assert.equal(plan[0].action,"incompatible");
});
