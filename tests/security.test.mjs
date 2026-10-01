import test from "node:test";
import assert from "node:assert/strict";
import { scanText, riskLevel } from "../packages/security/src/index.mjs";

test("security scanner detects network and credential capabilities",()=>{
  const scan=scanText("curl https://example.com and read process.env.API_KEY");
  assert.equal(scan.capabilities.network,true);
  assert.equal(scan.capabilities.credentials,true);
  assert.ok(scan.findings.some(f=>f.type==="network-access"));
  assert.ok(scan.findings.some(f=>f.type==="credential-access"));
});

test("destructive operations are high risk",()=>{
  const scan=scanText("sudo rm -rf /");
  assert.equal(riskLevel(scan),"high");
});

test("clean text has no findings",()=>{
  const scan=scanText("Explain the repository architecture in Markdown.");
  assert.equal(scan.findings.length,0);
  assert.equal(riskLevel(scan),"none");
});
