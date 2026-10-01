import test from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "../apps/mcp-server/src/server.mjs";

function parse(value){return JSON.parse(value);}

test("MCP discovery advertises the Skills extension",()=>{
  const response=parse(handleMessage({jsonrpc:"2.0",id:10,method:"server/discover",params:{}}));
  assert.equal(response.result.capabilities.extensions["io.modelcontextprotocol/skills"].directoryRead,false);
});

test("MCP initialize advertises the Skills extension",()=>{
  const response=parse(handleMessage({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2026-07-28"}}));
  assert.equal(response.result.capabilities.extensions["io.modelcontextprotocol/skills"].directoryRead,false);
  assert.deepEqual(response.result.serverInfo,{name:"ai-skills-hub",version:"0.2.0"});
});

test("MCP skills/list includes cache metadata and is paginatable",()=>{
  const response=parse(handleMessage({jsonrpc:"2.0",id:2,method:"skills/list",params:{}}));
  assert.equal(response.result.resultType,"complete");
  assert.equal(response.result.ttlMs,300000);
  assert.equal(response.result.cacheScope,"public");
  assert.ok(Array.isArray(response.result.skills));
});

test("MCP skills/get rejects unknown skill URIs",()=>{
  const response=parse(handleMessage({jsonrpc:"2.0",id:3,method:"skills/get",params:{uri:"skill://missing/SKILL.md"}}));
  assert.equal(response.error.code,-32602);
});


test("MCP rejects traversal-like resource URIs",()=>{
  const response=parse(handleMessage({jsonrpc:"2.0",id:11,method:"resources/read",params:{uri:"skill://missing/../SKILL.md"}}));
  assert.equal(response.error.code,-32602);
});
