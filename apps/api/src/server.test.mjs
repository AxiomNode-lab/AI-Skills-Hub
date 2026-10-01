import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "./server.mjs";

let server;
let base;

test("api health and pagination work", async (t) => {
  server=createServer();
  await new Promise((resolve)=>server.listen(0,resolve));
  const address=server.address();
  base="http://127.0.0.1:"+address.port;

  const health=await fetch(base+"/api/health");
  assert.equal(health.status,200);
  const healthBody=await health.json();
  assert.equal(healthBody.status,"ok");

  const page=await fetch(base+"/api/skills?limit=2&offset=0");
  assert.equal(page.status,200);
  const body=await page.json();
  assert.equal(body.limit,2);
  assert.equal(body.skills.length,2);
  assert.equal(typeof body.total,"number");
});

test.after(() => {
  server?.close();
});
