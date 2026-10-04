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

test("dynamic execution is detected without matching the JavaScript function keyword", () => {
  const dynamic = (text) => scanText(text).findings.some(f => f.type === "dynamic-execution");
  for (const text of ["eval(userInput)", "exec(code)", "EXEC(@sql)", "Eval(x)", "child_process.exec(cmd)", "new Function(body)", "Function (\"return this\")()", "re.exec(line)"]) {
    assert.equal(dynamic(text), true, text);
  }
  for (const text of ["function (a, b) { return a + b; }", "setTimeout(function () {})", "// HTTP function (API endpoint)"]) {
    assert.equal(dynamic(text), false, text);
  }
  assert.notEqual(riskLevel(scanText("const add = function (a) { return a; };").findings), "high");
});
