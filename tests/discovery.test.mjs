import test from "node:test";
import assert from "node:assert/strict";
import { searchRegistry, toInstallChoices } from "../packages/discovery/src/index.mjs";

const registry={skills:[
  {id:"demo/pdf-tool",name:"pdf-tool",publisher:"demo",description:"Create and process PDF files",category:["documents"],tags:["pdf"],compatibility:["agent-skills","codex"],distribution:"bundled",materialized:true,release:{status:"eligible"},security:{risk:"none"}},
  {id:"demo/react",name:"react-helper",publisher:"demo",description:"React frontend patterns",category:["frontend"],tags:["react"],compatibility:["agent-skills","codex"],distribution:"source-direct",source:{repo:"demo/repo",path:"skills/react-helper"}}
]};

test("natural language query ranks token matches",()=>{
  const result=searchRegistry(registry,"pdf documents",{agent:"codex",limit:5});
  assert.equal(result[0].item.id,"demo/pdf-tool");
});

test("released bundle becomes local install choice",()=>{
  const result=searchRegistry(registry,"pdf",{agent:"codex"});
  const choices=toInstallChoices({results:result},"codex");
  assert.equal(choices[0].action,"install");
});

test("source-direct becomes upstream bridge",()=>{
  const result=searchRegistry(registry,"react",{agent:"codex"});
  const choices=toInstallChoices({results:result},"codex");
  assert.equal(choices[0].action,"source-direct");
  assert.match(choices[0].command,/npx/);
});
