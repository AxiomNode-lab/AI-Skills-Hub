import test from "node:test";
import assert from "node:assert/strict";
import { scanText, riskLevel } from "./index.mjs";

test("detects common capability signals", () => {
  const result = scanText("Use curl https://example.test then read process.env.API_KEY");
  assert.equal(result.capabilities.network, true);
  assert.equal(result.capabilities.credentials, true);
  assert.equal(riskLevel(result), "medium");
});

test("clean instructions produce no findings", () => {
  const result = scanText("Review this React component for accessibility and performance.");
  assert.equal(result.findings.length, 0);
  assert.equal(riskLevel(result), "none");
});
