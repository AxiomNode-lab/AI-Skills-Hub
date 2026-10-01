import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../apps/api/src/server.mjs";

let server;
let base;

test("API endpoints expose health, skills, and bundles",async(t)=>{
  server=createServer();
  await new Promise((resolve)=>server.listen(0,resolve));
  t.after(()=>server.close());
  const address=server.address();
  base="http://127.0.0.1:"+address.port;

  const health=await fetch(base+"/api/health");
  assert.equal(health.status,200);
  assert.equal((await health.json()).status,"ok");

  const search=await fetch(base+"/api/skills?q=frontend&limit=10");
  assert.equal(search.status,200);
  const searchJson=await search.json();
  assert.ok(searchJson.skills.some((s)=>s.name.includes("frontend") || s.category.includes("frontend")));

  const bundles=await fetch(base+"/api/bundles");
  assert.equal(bundles.status,200);
  const bundleJson=await bundles.json();
  assert.ok(bundleJson.bundles["@core"]);
});
