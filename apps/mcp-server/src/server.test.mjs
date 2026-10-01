import test from "node:test";
import assert from "node:assert/strict";
import { handleMessage } from "./server.mjs";

test("initialize advertises MCP Skills extension", () => {
  const response=JSON.parse(handleMessage({
    jsonrpc:"2.0",
    id:1,
    method:"initialize",
    params:{protocolVersion:"2026-07-28"}
  }));
  assert.equal(response.result.capabilities.extensions["io.modelcontextprotocol/skills"].directoryRead,false);
});

test("skills/list returns complete cacheable shape", () => {
  const response=JSON.parse(handleMessage({
    jsonrpc:"2.0",
    id:2,
    method:"skills/list",
    params:{}
  }));
  assert.equal(response.result.resultType,"complete");
  assert.ok(Array.isArray(response.result.skills));
  assert.equal(typeof response.result.ttlMs,"number");
  assert.equal(response.result.cacheScope,"public");
});

test("unknown skill returns invalid params", () => {
  const response=JSON.parse(handleMessage({
    jsonrpc:"2.0",
    id:3,
    method:"skills/get",
    params:{uri:"skill://missing/SKILL.md"}
  }));
  assert.equal(response.error.code,-32602);
});

test("notifications do not generate JSON-RPC responses", () => {
  assert.equal(handleMessage({
    jsonrpc:"2.0",
    method:"notifications/initialized"
  }),null);
});
