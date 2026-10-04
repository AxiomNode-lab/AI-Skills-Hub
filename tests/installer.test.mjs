import test from "node:test";
import assert from "node:assert/strict";
import { buildInstallPlan } from "../packages/installer/src/index.mjs";

const base={id:"demo/skill",name:"demo-skill",license:{spdx:"MIT",redistributable:true,status:"verified"},source:{repo:"demo/repo",path:"skills/demo-skill",revision:"0".repeat(40)},compatibility:["agent-skills","codex","claude-code"],security:{scan_status:"pending",risk:"none"},release:{status:"hold"},materialized:false};

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
  for(const skill of [
    {...base,distribution:"source-direct",compatibility:["claude-code"]},
    {...base,distribution:"source-direct",artifact_type:"mcp-server",compatibility:["agent-skills","claude-code"]}
  ]) assert.equal(buildInstallPlan([skill],"codex")[0].action,"incompatible");
  assert.equal(buildInstallPlan([{...base,distribution:"source-direct",compatibility:["agent-skills"]}],"unknown-agent")[0].action,"incompatible");
});


test("install plan marks compatible bundled release as local install",()=>{
  const skill={...base,distribution:"bundled",materialized:true,release:{status:"eligible"},security:{scan_status:"verified",risk:"none"}};
  const plan=buildInstallPlan([skill],"codex");
  assert.equal(plan[0].action,"install");
});
