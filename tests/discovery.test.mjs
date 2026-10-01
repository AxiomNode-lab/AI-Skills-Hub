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

test("Arabic technical request finds the PDF intent",()=>{
  const result=searchRegistry(registry,"بدي أداة PDF",{agent:"codex",limit:5});
  assert.equal(result[0].item.id,"demo/pdf-tool");
});

test("remote discovery does not claim unverified agent compatibility",async()=>{
  const fakeFetch=async()=>({ok:true,json:async()=>({items:[{path:"skills/pdf-helper/SKILL.md"}]})});
  const result=await (await import("../packages/discovery/src/index.mjs")).searchRemote("PDF",{
    sources:[{id:"remote/source",kind:"github",repo:"remote/source",default_branch:"main"}],
    agent:"codex",limit:5,fetchImpl:fakeFetch,cacheDir:"/tmp/ai-skills-hub-discovery-tests-"+process.pid+"-"+Date.now()+"-"+Math.random()
  });
  assert.equal(result[0].item.name,"pdf-helper");
  assert.equal(result[0].item.compatibility_verified,false);
});

test("skills.sh results retain install URL and provenance",async()=>{
  const fakeFetch=async()=>({
    ok:true,
    json:async()=>({data:[{
      id:"owner/repo/demo",
      name:"demo",
      source:"owner/repo",
      installUrl:"https://github.com/owner/repo",
      url:"https://skills.sh/owner/repo/demo",
      installs:100
    }]})
  });
  const mod=await import("../packages/discovery/src/index.mjs");
  const result=await mod.searchSkillsSh("demo",{
    agent:"codex",
    limit:5,
    source:{api:"https://skills.sh/api/v1/skills/search"},
    fetchImpl:fakeFetch,
    cacheDir:"/tmp/ai-skills-hub-skills-sh-tests-final"
  });
  assert.equal(result[0].item.source.install_url,"https://github.com/owner/repo");
});

test("MCP Registry provider normalizes a remote HTTP server",async()=>{
  const fakeFetch=async()=>({
    ok:true,
    json:async()=>({servers:[{
      server:{
        name:"io.example/docs",
        title:"Docs MCP",
        description:"Search documentation",
        version:"1.0.0",
        repository:{url:"https://github.com/example/docs",source:"github"},
        remotes:[{type:"streamable-http",url:"https://example.com/mcp"}]
      },
      _meta:{"io.modelcontextprotocol.registry/official":{status:"active"}}
    }]})
  });
  const {searchMcpRegistry}=await import("../packages/discovery/src/mcp-registry.mjs");
  const result=await searchMcpRegistry("docs",{limit:5,fetchImpl:fakeFetch,cacheDir:"/tmp/aih-mcp-test-"+process.pid});
  assert.equal(result[0].item.artifact_type,"mcp-server");
  assert.equal(result[0].item.installation.url,"https://example.com/mcp");
});

test("npm provider returns AI CLI candidates only",async()=>{
  const fakeFetch=async()=>({
    ok:true,
    json:async()=>({objects:[{
      package:{
        name:"demo-ai-cli",
        version:"1.2.3",
        description:"AI agent command line tool",
        keywords:["ai","cli"],
        publisher:{username:"demo"},
        links:{npm:"https://npmjs.com/package/demo-ai-cli"}
      }
    }]})
  });
  const {searchNpmTools}=await import("../packages/discovery/src/npm.mjs");
  const result=await searchNpmTools("demo",{limit:5,fetchImpl:fakeFetch,cacheDir:"/tmp/aih-npm-test-"+process.pid});
  assert.equal(result[0].item.artifact_type,"cli-tool");
  assert.equal(result[0].item.source.package,"demo-ai-cli");
});

test("plugin discovery normalizes a portable Agent Plugin",async()=>{
  const fakeFetch=async()=>({
    ok:true,
    json:async()=>({items:[{
      path:"plugins/demo/plugin.json",
      repository:{full_name:"demo/plugins",default_branch:"main"}
    }]})
  });
  const {searchAgentPlugins}=await import("../packages/discovery/src/plugins.mjs");
  const result=await searchAgentPlugins("demo",{limit:5,fetchImpl:fakeFetch,cacheDir:"/tmp/aih-plugin-test-"+process.pid});
  assert.equal(result[0].item.artifact_type,"agent-plugin");
  assert.equal(result[0].item.source.repo,"demo/plugins");
});

test("MCP discovery broadens natural-language queries to useful tokens",async()=>{
  const calls=[];
  const fakeFetch=async(url)=>{
    calls.push(url);
    return {ok:true,json:async()=>({servers:[]})};
  };
  const {searchMcpRegistry}=await import("../packages/discovery/src/mcp-registry.mjs");
  await searchMcpRegistry("PDF tools for Codex",{limit:5,fetchImpl:fakeFetch,cacheDir:"/tmp/aih-mcp-broad-"+process.pid});
  assert.ok(calls.length >= 2);
});
