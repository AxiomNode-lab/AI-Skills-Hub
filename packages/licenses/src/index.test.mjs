import test from "node:test";
import assert from "node:assert/strict";
import { classifyLicense, normalizeLicense } from "./index.mjs";

test("normalizes common license names", () => {
  assert.equal(normalizeLicense("Apache License, Version 2.0"), "Apache-2.0");
  assert.equal(normalizeLicense("MIT License"), "MIT");
});

test("unknown licenses stay review-required", () => {
  const result = classifyLicense("");
  assert.equal(result.status, "review-required");
  assert.equal(result.redistributable, false);
});

test("permissive licenses are recognized", () => {
  const result = classifyLicense("MIT");
  assert.equal(result.status, "verified");
  assert.equal(result.redistributable, true);
});
