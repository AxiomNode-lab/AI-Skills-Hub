import test from "node:test";
import assert from "node:assert/strict";
import { buildInstallPlan } from "./index.mjs";

const skill = (distribution, materialized = false) => ({
  id: "example/" + distribution,
  name: "example",
  distribution,
  materialized,
  license: {spdx:"MIT"},
  source: {repo:"example/repo"}
});

test("review-required is held by default", () => {
  const [item] = buildInstallPlan([skill("review-required")], "codex");
  assert.equal(item.action, "hold");
  assert.equal(item.command, null);
});

test("bundle-eligible but unmaterialized uses a source bridge", () => {
  const [item] = buildInstallPlan([skill("bundled", false)], "codex");
  assert.equal(item.action, "source-bridge");
});

test("materialized bundle installs from registry", () => {
  const [item] = buildInstallPlan([skill("bundled", true)], "codex");
  assert.equal(item.action, "install");
  assert.match(item.command, /install-from-registry/);
});

test("review override is explicit", () => {
  const [item] = buildInstallPlan([skill("review-required")], "codex", {allowReview:true});
  assert.equal(item.action, "source-direct");
});
