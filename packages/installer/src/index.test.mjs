import test from "node:test";
import assert from "node:assert/strict";
import { buildInstallPlan } from "./index.mjs";

const skill = (distribution) => ({
  id: "example/" + distribution,
  name: "example",
  distribution,
  license: {spdx:"MIT"},
  source: {repo:"example/repo"}
});

test("review-required is held by default", () => {
  const [item] = buildInstallPlan([skill("review-required")], "codex");
  assert.equal(item.action, "hold");
  assert.equal(item.command, null);
});

test("bundled skill produces an install command", () => {
  const [item] = buildInstallPlan([skill("bundled")], "codex");
  assert.equal(item.action, "install");
  assert.match(item.command, /npx skills add/);
});

test("review override is explicit", () => {
  const [item] = buildInstallPlan([skill("review-required")], "codex", {allowReview:true});
  assert.equal(item.action, "source-direct");
});
