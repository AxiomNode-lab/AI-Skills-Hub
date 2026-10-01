import test from "node:test";
import assert from "node:assert/strict";
import { buildInstallPlan } from "../packages/installer/src/index.mjs";

const base={id:"demo/skill",name:"demo-skill",license:{spdx:"MIT"},source:{repo:"demo/repo",path:"skills/demo-skill"}};

test("non-materialized bundled skill is an explicit source bridge",()=>{
  const plan=buildInstallPlan([{...base,distribution:"bundled",materialized:false}],"codex");
  assert.equal(plan[0].action,"source-bridge");
  assert.match(plan[0].command,/npx skills add/);
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
